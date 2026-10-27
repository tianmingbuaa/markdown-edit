/**
 * The contract between the Electron main process, the preload bridge and the
 * renderer. Keep this file free of Node.js and Electron imports so it can be
 * consumed by both TypeScript projects.
 */

export const APP_NAME = '墨页'
export const APP_TAGLINE = '专注书写的 Markdown 编辑器'

export const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'mdown', 'mkd', 'mkdn', 'mdx'] as const

export type Platform = 'darwin' | 'win32' | 'linux' | 'other'

export interface DocumentSnapshot {
  /** Opaque token that binds subsequent saves to this exact open document. */
  sessionId: string
  path: string
  name: string
  content: string
  size: number
  modifiedAt: number
}

export type OpenDocumentResult =
  | { status: 'opened'; document: DocumentSnapshot }
  | { status: 'canceled' }
  | { status: 'error'; message: string }

export interface SaveDocumentInput {
  sessionId: string
  content: string
}

export type SaveErrorCode = 'no-document' | 'stale-document' | 'write-failed'

export type SaveDocumentResult =
  | { status: 'saved'; savedAt: number; bytes: number }
  | { status: 'error'; code: SaveErrorCode; message: string }

export interface WindowState {
  isMaximized: boolean
  isFullScreen: boolean
}

export interface AppInfo {
  platform: Platform
  appVersion: string
  electronVersion: string
}

export type Unsubscribe = () => void

export interface DesktopApi {
  getAppInfo(): AppInfo
  openDocument(): Promise<OpenDocumentResult>
  saveDocument(input: SaveDocumentInput): Promise<SaveDocumentResult>
  /** Synchronous last-chance write used by the renderer's beforeunload hook. */
  flushDocument(input: SaveDocumentInput): SaveDocumentResult
  minimizeWindow(): void
  toggleMaximizeWindow(): void
  closeWindow(): void
  getWindowState(): Promise<WindowState>
  onWindowStateChange(callback: (state: WindowState) => void): Unsubscribe
}
