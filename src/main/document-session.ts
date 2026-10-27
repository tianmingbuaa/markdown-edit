import { randomUUID } from 'node:crypto'
import {
  chmodSync,
  closeSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { dialog } from 'electron'
import type { BrowserWindow, OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import { MARKDOWN_EXTENSIONS } from '../shared/desktop-api'
import type {
  DocumentSnapshot,
  OpenDocumentResult,
  SaveDocumentInput,
  SaveErrorCode,
  SaveDocumentResult
} from '../shared/desktop-api'

/** Documents larger than this are rejected before their content reaches the renderer. */
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024

const UTF8_BOM_LENGTH = 3

interface ActiveDocument {
  sessionId: string
  path: string
  name: string
}

let activeDocument: ActiveDocument | null = null

function createOpenDialogOptions(): OpenDialogOptions {
  return {
    title: '打开 Markdown 文件',
    properties: ['openFile'],
    filters: [
      { name: 'Markdown 文件', extensions: [...MARKDOWN_EXTENSIONS] },
      { name: '所有文件', extensions: ['*'] }
    ]
  }
}

export function getActiveDocumentName(): string | null {
  return activeDocument?.name ?? null
}

/** Drops the session so a freshly created window cannot save into a stale file. */
export function resetDocumentSession(): void {
  activeDocument = null
}

async function showOpenDialog(parentWindow: BrowserWindow | null): Promise<OpenDialogReturnValue> {
  const options = createOpenDialogOptions()
  return parentWindow && !parentWindow.isDestroyed()
    ? dialog.showOpenDialog(parentWindow, options)
    : dialog.showOpenDialog(options)
}

export async function openDocument(
  parentWindow: BrowserWindow | null
): Promise<OpenDocumentResult> {
  let selection: OpenDialogReturnValue
  try {
    selection = await showOpenDialog(parentWindow)
  } catch (error) {
    return openError(`无法打开文件选择窗口：${describeError(error)}`)
  }

  if (selection.canceled) return { status: 'canceled' }

  const filePath = selection.filePaths[0]
  if (!filePath) return { status: 'canceled' }

  try {
    const stats = statSync(filePath)
    if (!stats.isFile()) return openError('所选路径不是文件，无法打开。')
    if (stats.size > MAX_DOCUMENT_BYTES) return tooLargeError()

    const buffer = readFileSync(filePath)
    if (buffer.byteLength > MAX_DOCUMENT_BYTES) return tooLargeError()

    const textBuffer = hasUtf8Bom(buffer) ? buffer.subarray(UTF8_BOM_LENGTH) : buffer
    const content = textBuffer.toString('utf8')
    const document: DocumentSnapshot = {
      sessionId: randomUUID(),
      path: filePath,
      name: basename(filePath),
      content,
      size: stats.size,
      modifiedAt: stats.mtimeMs
    }

    activeDocument = {
      sessionId: document.sessionId,
      path: document.path,
      name: document.name
    }

    return { status: 'opened', document }
  } catch (error) {
    return openError(`读取文件失败：${describeError(error)}`)
  }
}

/**
 * Writes the current active document synchronously and atomically. Both the
 * async IPC save and the renderer's beforeunload flush go through this function.
 */
export function saveActiveDocument(input: unknown): SaveDocumentResult {
  const document = activeDocument
  if (!document) return saveError('no-document', '当前没有打开的文档。')

  const request = parseSaveInput(input)
  if (!request) return saveError('write-failed', '保存参数无效。')

  if (request.sessionId !== document.sessionId) {
    return saveError(
      'stale-document',
      '文档会话已失效，请重新打开文件后再保存。'
    )
  }

  try {
    const bytes = writeFileAtomically(document.path, request.content)
    return { status: 'saved', savedAt: Date.now(), bytes }
  } catch (error) {
    return saveError('write-failed', `保存文件失败：${describeError(error)}`)
  }
}

function parseSaveInput(value: unknown): SaveDocumentInput | null {
  if (typeof value !== 'object' || value === null) return null

  const candidate = value as { sessionId?: unknown; content?: unknown }
  if (typeof candidate.sessionId !== 'string' || typeof candidate.content !== 'string') return null

  return { sessionId: candidate.sessionId, content: candidate.content }
}

/**
 * Writes to a temporary file in the same directory, flushes it, then renames it
 * over the target so a crash cannot leave a half-written document. The original
 * permission bits are restored on a best-effort basis.
 */
function writeFileAtomically(filePath: string, content: string): number {
  const tempPath = join(dirname(filePath), `.${basename(filePath)}.${randomUUID()}.tmp`)
  const mode = readPermissionMode(filePath)
  let descriptor: number | null = null

  try {
    descriptor = openSync(tempPath, 'w', mode ?? 0o600)
    writeFileSync(descriptor, content, { encoding: 'utf8' })
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = null

    if (mode !== null) {
      try {
        chmodSync(tempPath, mode)
      } catch {
        // Permission preservation is best-effort (for example on Windows).
      }
    }

    renameSync(tempPath, filePath)
    return Buffer.byteLength(content, 'utf8')
  } catch (error) {
    if (descriptor !== null) {
      try {
        closeSync(descriptor)
      } catch {
        // The descriptor is already unusable; keep the original error.
      }
    }
    removeTempFile(tempPath)
    throw error
  }
}

function readPermissionMode(filePath: string): number | null {
  try {
    return statSync(filePath).mode & 0o777
  } catch {
    return null
  }
}

function removeTempFile(tempPath: string): void {
  try {
    rmSync(tempPath, { force: true })
  } catch {
    // Cleanup is best-effort and must not mask the original write error.
  }
}

function hasUtf8Bom(buffer: Buffer): boolean {
  return (
    buffer.byteLength >= UTF8_BOM_LENGTH &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf
  )
}

function describeError(error: unknown): string {
  const code = (error as NodeJS.ErrnoException).code

  switch (code) {
    case 'ENOENT':
      return '文件不存在或已被移动。'
    case 'EACCES':
    case 'EPERM':
      return '没有访问该文件的权限。'
    case 'EMFILE':
    case 'ENFILE':
      return '系统打开的文件过多，请稍后重试。'
    case 'ENOSPC':
      return '磁盘空间不足。'
    default:
      return error instanceof Error && error.message.length > 0 ? error.message : '未知错误。'
  }
}

function openError(message: string): OpenDocumentResult {
  return { status: 'error', message }
}

function tooLargeError(): OpenDocumentResult {
  return openError('文件大小超过 20 MiB，无法打开。')
}

function saveError(code: SaveErrorCode, message: string): SaveDocumentResult {
  return { status: 'error', code, message }
}
