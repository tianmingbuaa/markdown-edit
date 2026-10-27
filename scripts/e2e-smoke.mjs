/**
 * End-to-end smoke test for the built Electron application.
 *
 * It exercises the real IPC/preload boundary, file dialog mock, Vditor editing,
 * debounced autosave, manual save, save-before-switch and close-flush.
 *
 * Usage:
 *   pnpm test:e2e
 *   xvfb-run -a pnpm test:e2e   # on a headless Linux host
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright-core'

const require = createRequire(import.meta.url)
const electronExecutable = require('electron')
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appEntry = path.join(projectRoot, 'out/main/index.js')
const workDir = mkdtempSync(path.join(tmpdir(), 'inkpage-e2e-'))
const firstFile = path.join(workDir, 'first.md')
const secondFile = path.join(workDir, 'second.md')

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function writeFixture(filePath, title, body) {
  writeFileSync(
    filePath,
    `# ${title}\n\n${body}\n\n## 清单\n\n- 第一项\n- 第二项\n\n\`\`\`ts\nconst ink = true\n\`\`\`\n\n用于继续键入的收尾段落。\n`,
    'utf8'
  )
}

async function waitForFileMarker(filePath, marker, timeout = 6000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeout) {
    try {
      if (readFileSync(filePath, 'utf8').includes(marker)) return
    } catch {
      // The document is being atomically renamed; briefly missing is fine.
    }
    await sleep(100)
  }
  throw new Error(`Timed out waiting for "${marker}" in ${path.basename(filePath)}`)
}

async function waitForEditorReady(page) {
  await page.locator('.vditor-ir pre.vditor-reset').waitFor({ timeout: 30_000 })
  await page.waitForFunction(() => !document.querySelector('.editor-loading'), undefined, {
    timeout: 30_000
  })
}

async function appendToEditor(page, text) {
  await waitForEditorReady(page)
  const root = page.locator('.vditor-ir pre.vditor-reset')
  await root.click({ position: { x: 260, y: 110 } })
  await page.keyboard.press('Control+End')
  await page.keyboard.insertText(text)
}

async function setDialogTarget(application, filePath) {
  await application.evaluate(({ dialog }, target) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] })
  }, filePath)
}

async function run() {
  assert.ok(
    (() => {
      try {
        readFileSync(appEntry)
        return true
      } catch {
        return false
      }
    })(),
    'Missing out/main/index.js. Run `pnpm build` first.'
  )

  writeFixture(firstFile, '第一篇文稿', '用于验证自动保存与文件切换。')
  writeFixture(secondFile, '第二篇文稿', '用于验证重新挂载后的编辑器。')

  const consoleErrors = []
  let application

  try {
    application = await electron.launch({
      executablePath: electronExecutable,
      args: [appEntry],
      cwd: projectRoot,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ELECTRON_DISABLE_GPU: '1'
      },
      timeout: 60_000
    })

    const page = await application.firstWindow()
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => {
      consoleErrors.push(String(error))
    })

    await page.locator('.app').waitFor({ timeout: 30_000 })
    await page.evaluate(() => document.fonts.ready)
    assert.equal(
      (await page.locator('.welcome__title').innerText()).includes('安静地'),
      true,
      'Welcome screen should render'
    )
    console.log('✓ welcome screen')

    await setDialogTarget(application, firstFile)
    await page.locator('.primary-button').click()
    await waitForEditorReady(page)
    await page.waitForFunction(
      () => document.querySelectorAll('.vditor-toolbar__item svg').length > 10,
      undefined,
      { timeout: 15_000 }
    )
    assert.equal(await page.locator('.titlebar__document-name').innerText(), 'first.md')
    assert.ok(
      (await page.evaluate(() => document.querySelectorAll('svg symbol').length)) >= 40,
      'Vditor icon sprite should be loaded'
    )
    console.log('✓ open file + Vditor IR toolbar')

    await appendToEditor(page, '\n\nAUTOSAVE_E2E')
    await waitForFileMarker(firstFile, 'AUTOSAVE_E2E')
    await page.waitForFunction(
      () => document.querySelector('.save-status')?.textContent?.includes('已自动保存') === true,
      undefined,
      { timeout: 5000 }
    )
    console.log('✓ debounced autosave')

    await appendToEditor(page, '\n\nMANUAL_SAVE_E2E')
    await page.keyboard.press('Control+S')
    await waitForFileMarker(firstFile, 'MANUAL_SAVE_E2E', 2500)
    console.log('✓ Ctrl+S manual save')

    await setDialogTarget(application, secondFile)
    await appendToEditor(page, '\n\nOPEN_FLUSH_E2E')
    await page.keyboard.press('Control+O')
    await page.waitForFunction(
      () => document.querySelector('.titlebar__document-name')?.textContent === 'second.md',
      undefined,
      { timeout: 15_000 }
    )
    await waitForEditorReady(page)
    await waitForFileMarker(firstFile, 'OPEN_FLUSH_E2E')
    assert.equal(
      (await page.locator('.vditor-ir pre.vditor-reset').innerText()).includes('第二篇文稿'),
      true
    )
    assert.ok(
      (await page.evaluate(() => document.querySelectorAll('svg symbol').length)) >= 40,
      'Icon sprite should survive editor remount'
    )
    console.log('✓ save before switch + editor remount')

    await appendToEditor(page, '\n\nCLOSE_FLUSH_E2E')
    await Promise.race([
      page.evaluate(() => window.inkpage.closeWindow()).catch(() => undefined),
      sleep(1500)
    ])
    await waitForFileMarker(secondFile, 'CLOSE_FLUSH_E2E', 4000)
    await sleep(500)
    console.log('✓ flush latest content on close')

    assert.deepEqual(consoleErrors, [], 'Renderer console should be clean')
    console.log(`\nAll E2E checks passed (${path.basename(workDir)})`)
  } finally {
    if (application) {
      await application.close().catch(() => undefined)
    }
    rmSync(workDir, { recursive: true, force: true })
  }
}

run().catch((error) => {
  console.error('\nE2E failed:', error)
  process.exitCode = 1
})
