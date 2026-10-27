import { useEffect, useRef, useState } from 'react'
import Vditor from 'vditor'

interface MarkdownEditorProps {
  initialValue: string
  sessionId: string
  onChange: (markdown: string) => void
  registerValueGetter: (sessionId: string, getValue: (() => string) | null) => void
}

function resolveVditorAssets(): string {
  return new URL('./vditor', window.location.href).href.replace(/\/+$/, '')
}

export function MarkdownEditor({
  initialValue,
  sessionId,
  onChange,
  registerValueGetter
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const onChangeRef = useRef(onChange)
  const mountedRef = useRef(true)
  const isReadyRef = useRef(false)
  const [isReady, setIsReady] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    mountedRef.current = true
    const container = containerRef.current
    if (!container) {
      return
    }

    const cdn = resolveVditorAssets()
    let focusTimer: number | null = null
    let compositionTimer: number | null = null
    let isComposing = false
    let editor: Vditor | null = null

    const emitLatestValue = (): void => {
      if (!mountedRef.current || !isReadyRef.current || !editor) {
        return
      }

      try {
        onChangeRef.current(editor.getValue())
      } catch (error) {
        console.warn('[inkpage] Could not read the latest editor value', error)
      }
    }

    const handleDomInput = (event: Event): void => {
      const inputEvent = event as InputEvent
      if (isComposing || inputEvent.isComposing || inputEvent.inputType === 'insertCompositionText') {
        return
      }
      emitLatestValue()
    }

    const handleCompositionStart = (): void => {
      isComposing = true
    }

    const handleCompositionEnd = (): void => {
      isComposing = false
      if (compositionTimer !== null) {
        window.clearTimeout(compositionTimer)
      }
      compositionTimer = window.setTimeout(() => {
        compositionTimer = null
        emitLatestValue()
      }, 0)
    }

    container.addEventListener('input', handleDomInput, true)
    container.addEventListener('compositionstart', handleCompositionStart, true)
    container.addEventListener('compositionend', handleCompositionEnd, true)

    try {
      editor = new Vditor(container, {
        mode: 'ir',
        value: initialValue,
        height: '100%',
        minHeight: 320,
        placeholder: '从一个念头开始…',
        lang: 'zh_CN',
        // The icon sprite is preloaded from index.html. Disabling Vditor's own
        // loader avoids its inline <script> injection, which a strict CSP blocks.
        icon: undefined,
        theme: 'classic',
        cdn,
        cache: { enable: false },
        counter: { enable: false },
        outline: { enable: false, position: 'left' },
        resize: { enable: false },
        toolbarConfig: { hide: false, pin: false },
        toolbar: [
          'headings',
          'bold',
          'italic',
          'strike',
          '|',
          'list',
          'ordered-list',
          'check',
          '|',
          'quote',
          'code',
          'inline-code',
          '|',
          'link',
          'table',
          'line',
          '|',
          'undo',
          'redo'
        ],
        preview: {
          delay: 120,
          hljs: { enable: true, lineNumber: false, style: 'github' },
          markdown: { sanitize: true },
          theme: {
            current: 'light',
            path: `${cdn}/dist/css/content-theme`
          }
        },
        // Keep Vditor's callback for toolbar-driven mutations; DOM input events
        // above make ordinary typing visible immediately, even while Vditor's
        // own IR processing callback is still being debounced.
        input: () => {
          emitLatestValue()
        },
        after: () => {
          if (!mountedRef.current || !editor) {
            return
          }

          isReadyRef.current = true
          const contentElement = container.querySelector<HTMLElement>(
            '.vditor-ir pre.vditor-reset'
          )
          contentElement?.setAttribute('aria-label', 'Markdown 正文')
          registerValueGetter(sessionId, () => editor?.getValue() ?? initialValue)
          setIsReady(true)
          focusTimer = window.setTimeout(() => {
            editor?.focus()
          }, 40)
        }
      })
    } catch (error) {
      console.error('[inkpage] Vditor failed to initialise', error)
      setInitError('编辑器初始化失败，请重新打开文件。')
    }

    return () => {
      mountedRef.current = false
      isReadyRef.current = false
      container.removeEventListener('input', handleDomInput, true)
      container.removeEventListener('compositionstart', handleCompositionStart, true)
      container.removeEventListener('compositionend', handleCompositionEnd, true)
      registerValueGetter(sessionId, null)
      if (focusTimer !== null) {
        window.clearTimeout(focusTimer)
      }
      if (compositionTimer !== null) {
        window.clearTimeout(compositionTimer)
      }
      try {
        editor?.destroy()
      } catch (error) {
        console.warn('[inkpage] Vditor cleanup failed', error)
      }
    }
  }, [initialValue, registerValueGetter, sessionId])

  return (
    <div className="markdown-editor" aria-busy={!isReady && !initError}>
      <div ref={containerRef} className="markdown-editor__mount" />
      {!isReady && !initError ? (
        <div className="editor-loading" role="status">
          <span className="editor-loading__mark" aria-hidden="true" />
          <span>正在铺开纸面…</span>
        </div>
      ) : null}
      {initError ? <div className="editor-error">{initError}</div> : null}
    </div>
  )
}
