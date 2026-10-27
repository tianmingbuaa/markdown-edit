import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import { APP_NAME } from '../shared/desktop-api'
import type { SaveDocumentResult, WindowState } from '../shared/desktop-api'
import {
  getActiveDocumentName,
  openDocument,
  resetDocumentSession,
  saveActiveDocument
} from './document-session'

const WINDOW_WIDTH = 1180
const WINDOW_HEIGHT = 800
const WINDOW_MIN_WIDTH = 780
const WINDOW_MIN_HEIGHT = 540
const WINDOW_BACKGROUND_COLOR = '#f3f1eb'

/** IPC channel names. Keep in sync with src/preload/index.ts. */
const IPC = {
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

const rendererEntryPath = join(__dirname, '../renderer/index.html')
const rendererEntryUrl = pathToFileURL(rendererEntryPath)
const rendererDevUrl = process.env.ELECTRON_RENDERER_URL
const windowIconPath = app.isPackaged
  ? join(process.resourcesPath, 'icon.png')
  : join(__dirname, '../../build/icon.png')

let mainWindow: BrowserWindow | null = null

function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

function getTrustedWindow(event: IpcMainEvent | IpcMainInvokeEvent): BrowserWindow | null {
  const window = getMainWindow()
  if (!window || event.sender !== window.webContents) return null
  return window
}

function requireTrustedWindow(event: IpcMainInvokeEvent): BrowserWindow {
  const window = getTrustedWindow(event)
  if (!window) throw new Error('未授权的窗口调用。')
  return window
}

function readWindowState(window: BrowserWindow): WindowState {
  return {
    isMaximized: window.isMaximized(),
    isFullScreen: window.isFullScreen()
  }
}

function broadcastWindowState(window: BrowserWindow): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) return
  window.webContents.send(IPC.windowStateChanged, readWindowState(window))
}

function applyDocumentTitle(window: BrowserWindow, name: string | null): void {
  if (window.isDestroyed()) return
  window.setTitle(name ? `${name} — ${APP_NAME}` : APP_NAME)
}

function isAppNavigation(targetUrl: string): boolean {
  let target: URL
  try {
    target = new URL(targetUrl)
  } catch {
    return false
  }

  if (rendererDevUrl) {
    try {
      return target.origin === new URL(rendererDevUrl).origin
    } catch {
      return false
    }
  }

  return target.protocol === 'file:' && target.pathname === rendererEntryUrl.pathname
}

function openExternalUrl(rawUrl: string): void {
  let target: URL
  try {
    target = new URL(rawUrl)
  } catch {
    return
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') return

  void shell.openExternal(target.toString()).catch(() => {
    // Opening the link is best-effort; the app must never navigate to it itself.
  })
}

function installNavigationGuards(window: BrowserWindow): void {
  const { webContents } = window

  webContents.setWindowOpenHandler(({ url }) => {
    if (!isAppNavigation(url)) openExternalUrl(url)
    return { action: 'deny' }
  })

  webContents.on('will-navigate', (event, url) => {
    if (isAppNavigation(url)) return
    event.preventDefault()
    openExternalUrl(url)
  })
}

function installWindowStateEvents(window: BrowserWindow): void {
  const notify = (): void => broadcastWindowState(window)

  window.on('maximize', notify)
  window.on('unmaximize', notify)
  window.on('enter-full-screen', notify)
  window.on('leave-full-screen', notify)
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    show: false,
    frame: false,
    title: APP_NAME,
    icon: windowIconPath,
    backgroundColor: WINDOW_BACKGROUND_COLOR,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
      webviewTag: false,
      navigateOnDragDrop: false
    }
  })

  mainWindow = window

  installNavigationGuards(window)
  installWindowStateEvents(window)

  window.once('ready-to-show', () => {
    if (!window.isDestroyed()) window.show()
  })

  // The main process owns the window title ("file name — 墨页").
  window.on('page-title-updated', (event) => {
    event.preventDefault()
  })

  window.on('closed', () => {
    resetDocumentSession()
    if (mainWindow === window) mainWindow = null
  })

  if (rendererDevUrl) {
    window.loadURL(rendererDevUrl).catch((error: unknown) => {
      console.error('[墨页] 无法加载开发服务器页面：', error)
    })
  } else {
    window.loadFile(rendererEntryPath).catch((error: unknown) => {
      console.error('[墨页] 无法加载渲染器页面：', error)
    })
  }

  return window
}

function saveDocumentAndUpdateTitle(window: BrowserWindow, input: unknown): SaveDocumentResult {
  const result = saveActiveDocument(input)

  if (result.status === 'saved') {
    applyDocumentTitle(window, getActiveDocumentName())
  }

  return result
}

function registerIpcHandlers(): void {
  ipcMain.on(IPC.appGetVersion, (event) => {
    event.returnValue = getTrustedWindow(event) ? app.getVersion() : null
  })

  ipcMain.handle(IPC.documentOpen, async (event) => {
    const window = requireTrustedWindow(event)
    const result = await openDocument(window)

    if (result.status === 'opened') {
      applyDocumentTitle(window, result.document.name)
    }

    return result
  })

  ipcMain.handle(IPC.documentSave, (event, input: unknown) => {
    return saveDocumentAndUpdateTitle(requireTrustedWindow(event), input)
  })

  // The renderer's beforeunload hook uses sendSync so the write finishes before
  // the window is allowed to close.
  ipcMain.on(IPC.documentFlushSync, (event, input: unknown) => {
    const window = getTrustedWindow(event)
    if (!window) {
      event.returnValue = {
        status: 'error',
        code: 'write-failed',
        message: '未授权的窗口调用。'
      } satisfies SaveDocumentResult
      return
    }

    event.returnValue = saveDocumentAndUpdateTitle(window, input)
  })

  ipcMain.on(IPC.windowMinimize, (event) => {
    getTrustedWindow(event)?.minimize()
  })

  ipcMain.on(IPC.windowToggleMaximize, (event) => {
    const window = getTrustedWindow(event)
    if (!window) return

    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
  })

  ipcMain.on(IPC.windowClose, (event) => {
    getTrustedWindow(event)?.close()
  })

  ipcMain.handle(IPC.windowGetState, (event) => {
    return readWindowState(requireTrustedWindow(event))
  })
}

app.setName(APP_NAME)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

void app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    const window = getMainWindow()
    if (!window) {
      createWindow()
      return
    }

    window.show()
    window.focus()
  })
})
