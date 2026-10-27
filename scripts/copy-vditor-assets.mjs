/**
 * Vditor loads its Lute engine, icons, i18n files, code highlighting and
 * content themes at runtime from a configurable CDN root. Copy the local
 * package's `dist` directory into the renderer's public assets so the editor
 * remains fully offline and deterministic.
 */
import { cp, mkdir, rm, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(projectRoot, 'node_modules/vditor/dist')
const destination = resolve(projectRoot, 'public/vditor/dist')

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

if (!(await exists(source))) {
  console.error('[assets] vditor is not installed. Run `pnpm install` first.')
  process.exit(1)
}

await rm(destination, { recursive: true, force: true })
await mkdir(dirname(destination), { recursive: true })
await cp(source, destination, { recursive: true })

console.log(`[assets] Vditor runtime assets copied to ${destination}`)
