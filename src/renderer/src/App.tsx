import { useEffect, useState } from 'react'
import type { AppInfo, WindowState } from '@shared/desktop-api'
import { MarkdownEditor } from './components/MarkdownEditor'
import { StatusBar } from './components/StatusBar'
import { TitleBar } from './components/TitleBar'
import { Toast } from './components/Toast'
import { Welcome } from './components/Welcome'
import { useDocumentSession } from './hooks/useDocumentSession'

function DesktopApp() {
  const api = window.inkpage
  const session = useDocumentSession()
  const [appInfo] = useState<AppInfo>(() => api.getAppInfo())
  const [windowState, setWindowState] = useState<WindowState>({
    isMaximized: false,
    isFullScreen: false
  })

  const isMac = appInfo.platform === 'darwin'
  const shortcutModifier = isMac ? '⌘' : 'Ctrl'
  const activeDocument = session.document

  useEffect(() => {
    let disposed = false

    void api
      .getWindowState()
      .then((state) => {
        if (!disposed) {
          setWindowState(state)
        }
      })
      .catch(() => undefined)

    const unsubscribe = api.onWindowStateChange((state) => {
      setWindowState(state)
    })

    return () => {
      disposed = true
      unsubscribe()
    }
  }, [api])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) {
        return
      }

      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        event.stopPropagation()
        void session.saveNow()
        return
      }

      if (key === 'o') {
        event.preventDefault()
        event.stopPropagation()
        void session.openDocument()
      }
    }

    window.addEventListener('keydown', handleShortcut, true)
    return () => window.removeEventListener('keydown', handleShortcut, true)
  }, [session.openDocument, session.saveNow])

  return (
    <div className="app">
      <div className="app__ambient" aria-hidden="true" />

      <TitleBar
        fileName={activeDocument?.name ?? null}
        filePath={activeDocument?.path ?? null}
        hasUnsavedChanges={session.hasUnsavedChanges}
        saveState={session.saveState}
        isOpening={session.isOpening}
        isMaximized={windowState.isMaximized}
        shortcutModifier={shortcutModifier}
        onOpen={() => void session.openDocument()}
        onSave={() => void session.saveNow()}
        onMinimize={() => api.minimizeWindow()}
        onToggleMaximize={() => api.toggleMaximizeWindow()}
        onClose={() => api.closeWindow()}
      />

      {session.isOpening ? <div className="open-progress" aria-hidden="true" /> : null}

      <main className={`workspace${activeDocument ? ' workspace--editing' : ''}`}>
        {activeDocument ? (
          <section className="editor-stage" aria-label="Markdown 编辑器">
            <div className="editor-card">
              <MarkdownEditor
                key={activeDocument.sessionId}
                initialValue={activeDocument.content}
                sessionId={activeDocument.sessionId}
                onChange={session.handleEditorChange}
                registerValueGetter={session.registerEditorValueBridge}
              />
            </div>
          </section>
        ) : (
          <Welcome
            isOpening={session.isOpening}
            shortcutModifier={shortcutModifier}
            onOpen={() => void session.openDocument()}
          />
        )}
      </main>

      <StatusBar
        document={activeDocument}
        stats={session.stats}
        saveState={session.saveState}
        lastSavedAt={session.lastSavedAt}
        saveError={session.saveError}
      />

      <Toast notice={session.notice} onDismiss={session.dismissNotice} />
    </div>
  )
}

export function App() {
  if (!window.inkpage) {
    return (
      <div className="fatal-screen">
        <div className="fatal-screen__mark">墨</div>
        <h1>桥接尚未就绪</h1>
        <p>Electron preload 没有成功加载。请关闭应用后重新启动。</p>
      </div>
    )
  }

  return <DesktopApp />
}
