import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  AppInfo,
  DesktopApi,
  OpenDocumentResult,
  Platform,
  SaveDocumentInput,
  SaveDocumentResult,
  WindowState
} from '../shared/desktop-api'

/** IPC channel names. Keep in sync with src/main/index.ts. */
const CHANNELS = {
  appGetVersion: 'app:get-version',
  documentOpen: 'document:open',
  documentSave: 'document:save',
  documentFlushSync: 'document:flush-sync',
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  windowGetState: 'window:get-state',
  windowStateChanged: 'window:state-changed'
} as const

const FALLBACK_VERSION = '0.0.0'

let cachedAppVersion: string | null = null

function toPlatform(platform: NodeJS.Platform): Platform {
  switch (platform) {
    case 'darwin':
      return 'darwin'
    case 'win32':
      return 'win32'
    case 'linux':
      return 'linux'
    default:
      return 'other'
  }
}

function getAppVersion(): string {
  if (cachedAppVersion) return cachedAppVersion

  try {
    const version: unknown = ipcRenderer.sendSync(CHANNELS.appGetVersion)
    if (typeof version === 'string' && version.length > 0) {
      cachedAppVersion = version
      return version
    }
  } catch {
    // The main process may not have registered the handler yet; use a neutral version.
  }

  return FALLBACK_VERSION
}

const desktopApi: DesktopApi = {
  getAppInfo(): AppInfo {
    return {
      platform: toPlatform(process.platform),
      appVersion: getAppVersion(),
      electronVersion: process.versions.electron || FALLBACK_VERSION
    }
  },

  openDocument(): Promise<OpenDocumentResult> {
    return ipcRenderer.invoke(CHANNELS.documentOpen) as Promise<OpenDocumentResult>
  },

  saveDocument(input: SaveDocumentInput): Promise<SaveDocumentResult> {
    return ipcRenderer.invoke(CHANNELS.documentSave, input) as Promise<SaveDocumentResult>
  },

  flushDocument(input: SaveDocumentInput): SaveDocumentResult {
    return ipcRenderer.sendSync(CHANNELS.documentFlushSync, input) as SaveDocumentResult
  },

  minimizeWindow(): void {
    ipcRenderer.send(CHANNELS.windowMinimize)
  },

  toggleMaximizeWindow(): void {
    ipcRenderer.send(CHANNELS.windowToggleMaximize)
  },

  closeWindow(): void {
    ipcRenderer.send(CHANNELS.windowClose)
  },

  getWindowState(): Promise<WindowState> {
    return ipcRenderer.invoke(CHANNELS.windowGetState) as Promise<WindowState>
  },

  onWindowStateChange(callback: (state: WindowState) => void): () => void {
    const listener = (_event: IpcRendererEvent, state: WindowState): void => {
      callback(state)
    }

    ipcRenderer.on(CHANNELS.windowStateChanged, listener)

    return () => {
      ipcRenderer.removeListener(CHANNELS.windowStateChanged, listener)
    }
  }
}

// Expose only the typed DesktopApi; ipcRenderer and Node.js stay in the preload context.
contextBridge.exposeInMainWorld('inkpage', desktopApi)
