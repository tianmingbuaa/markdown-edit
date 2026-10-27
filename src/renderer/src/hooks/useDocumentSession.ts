import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocumentSnapshot, SaveDocumentResult } from '@shared/desktop-api'
import { countText, type TextStats } from '../lib/stats'
import type { Notice, SaveState } from '../lib/types'

const AUTOSAVE_DELAY_MS = 700
const EMPTY_STATS: TextStats = { words: 0, characters: 0, lines: 0 }

type NoticeInput = Omit<Notice, 'id'>

interface EditorValueBridge {
  sessionId: string
  getValue: () => string
}

export interface DocumentSession {
  document: DocumentSnapshot | null
  stats: TextStats
  saveState: SaveState
  lastSavedAt: number | null
  saveError: string | null
  isOpening: boolean
  hasUnsavedChanges: boolean
  notice: Notice | null
  dismissNotice: () => void
  openDocument: () => Promise<void>
  saveNow: () => Promise<void>
  handleEditorChange: (markdown: string) => void
  registerEditorValueBridge: (sessionId: string, getValue: (() => string) | null) => void
  forceClose: () => void
}

function blurActiveElement(): void {
  const activeElement = window.document.activeElement
  if (activeElement instanceof HTMLElement) {
    activeElement.blur()
  }
}

export function useDocumentSession(): DocumentSession {
  const api = window.inkpage

  const [activeDocument, setActiveDocument] = useState<DocumentSnapshot | null>(null)
  const [stats, setStats] = useState<TextStats>(EMPTY_STATS)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isOpening, setIsOpening] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const documentRef = useRef<DocumentSnapshot | null>(null)
  const contentRef = useRef('')
  const savedContentRef = useRef('')
  const dirtyRef = useRef(false)
  const autosaveTimerRef = useRef<number | null>(null)
  const saveInFlightRef = useRef<Promise<boolean> | null>(null)
  const openingRef = useRef(false)
  const allowCloseRef = useRef(false)
  const noticeIdRef = useRef(0)
  const retrySaveRef = useRef<() => void>(() => undefined)
  const editorBridgeRef = useRef<EditorValueBridge | null>(null)

  const clearAutosaveTimer = useCallback((): void => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
  }, [])

  const pushNotice = useCallback((nextNotice: NoticeInput): void => {
    noticeIdRef.current += 1
    setNotice({ ...nextNotice, id: noticeIdRef.current })
  }, [])

  const registerEditorValueBridge = useCallback(
    (sessionId: string, getValue: (() => string) | null): void => {
      if (getValue) {
        editorBridgeRef.current = { sessionId, getValue }
        return
      }

      if (editorBridgeRef.current?.sessionId === sessionId) {
        editorBridgeRef.current = null
      }
    },
    []
  )

  /**
   * Vditor's own input callback can trail the DOM by a few frames. Reading the
   * live value whenever we persist guarantees that the last keystroke is saved,
   * including when the user closes the window immediately after typing.
   */
  const readLatestMarkdown = useCallback((): string => {
    const bridge = editorBridgeRef.current
    if (bridge && documentRef.current?.sessionId === bridge.sessionId) {
      try {
        const value = bridge.getValue()
        if (typeof value === 'string') {
          contentRef.current = value
          return value
        }
      } catch {
        // Fall back to the last input callback value.
      }
    }

    return contentRef.current
  }, [])

  const saveLatest = useCallback(async (): Promise<boolean> => {
    clearAutosaveTimer()

    if (saveInFlightRef.current) {
      return saveInFlightRef.current
    }

    if (!documentRef.current) {
      return true
    }

    if (!dirtyRef.current && readLatestMarkdown() === savedContentRef.current) {
      return true
    }

    // The live DOM can be ahead of the change callback (for example right
    // before closing). Treat that as a pending save.
    dirtyRef.current = true

    const run = async (): Promise<boolean> => {
      while (dirtyRef.current) {
        const currentDocument = documentRef.current
        if (!currentDocument) {
          return true
        }

        const sessionId = currentDocument.sessionId
        const content = readLatestMarkdown()
        setSaveState('saving')

        let result: SaveDocumentResult
        try {
          result = await api.saveDocument({ sessionId, content })
        } catch {
          if (documentRef.current?.sessionId !== sessionId) {
            return true
          }

          const message = '保存服务暂时不可用，请稍后重试。'
          setSaveState('error')
          setSaveError(message)
          pushNotice({
            kind: 'error',
            title: '保存失败',
            detail: message,
            actions: [
              {
                label: '重试',
                onClick: () => retrySaveRef.current()
              }
            ]
          })
          return false
        }

        if (documentRef.current?.sessionId !== sessionId) {
          return true
        }

        if (result.status === 'error') {
          if (result.code === 'stale-document') {
            return true
          }

          setSaveState('error')
          setSaveError(result.message)
          pushNotice({
            kind: 'error',
            title: '保存失败',
            detail: result.message,
            actions: [
              {
                label: '重试',
                onClick: () => retrySaveRef.current()
              }
            ]
          })
          return false
        }

        setLastSavedAt(result.savedAt)
        setSaveError(null)
        setNotice(null)

        if (readLatestMarkdown() === content) {
          savedContentRef.current = content
          dirtyRef.current = false
          setSaveState('saved')
        }
      }

      return true
    }

    const promise = run()
    saveInFlightRef.current = promise

    try {
      return await promise
    } finally {
      if (saveInFlightRef.current === promise) {
        saveInFlightRef.current = null
      }
    }
  }, [api, clearAutosaveTimer, pushNotice, readLatestMarkdown])

  retrySaveRef.current = () => {
    void saveLatest()
  }

  const forceClose = useCallback((): void => {
    allowCloseRef.current = true
    clearAutosaveTimer()
    api.closeWindow()
  }, [api, clearAutosaveTimer])

  const adoptDocument = useCallback(
    (nextDocument: DocumentSnapshot): void => {
      clearAutosaveTimer()
      editorBridgeRef.current = null
      documentRef.current = nextDocument
      contentRef.current = nextDocument.content
      savedContentRef.current = nextDocument.content
      dirtyRef.current = false

      setActiveDocument(nextDocument)
      setStats(countText(nextDocument.content))
      setSaveState('saved')
      setLastSavedAt(null)
      setSaveError(null)
      setNotice(null)
    },
    [clearAutosaveTimer]
  )

  const handleEditorChange = useCallback(
    (markdown: string): void => {
      if (!documentRef.current) {
        return
      }

      const changed = markdown !== contentRef.current
      contentRef.current = markdown
      setStats(countText(markdown))

      if (!changed) {
        return
      }

      dirtyRef.current = true
      setSaveState('dirty')
      clearAutosaveTimer()

      autosaveTimerRef.current = window.setTimeout(() => {
        autosaveTimerRef.current = null
        void saveLatest()
      }, AUTOSAVE_DELAY_MS)
    },
    [clearAutosaveTimer, saveLatest]
  )

  const saveNow = useCallback(async (): Promise<void> => {
    if (!documentRef.current) {
      return
    }

    await saveLatest()
  }, [saveLatest])

  const openDocument = useCallback(async (): Promise<void> => {
    if (openingRef.current) {
      return
    }

    openingRef.current = true
    setIsOpening(true)

    try {
      const pendingSaved = await saveLatest()
      if (!pendingSaved && dirtyRef.current) {
        pushNotice({
          kind: 'error',
          title: '暂时无法打开其他文件',
          detail: '当前文稿还没有成功保存，请先重试保存。'
        })
        return
      }

      blurActiveElement()
      const result = await api.openDocument()

      if (result.status === 'opened') {
        adoptDocument(result.document)
        return
      }

      if (result.status === 'error') {
        pushNotice({
          kind: 'error',
          title: '无法打开文件',
          detail: result.message
        })
      }
    } catch {
      pushNotice({
        kind: 'error',
        title: '无法打开文件',
        detail: '打开文件时发生意外错误，请重试。'
      })
    } finally {
      openingRef.current = false
      setIsOpening(false)
    }
  }, [adoptDocument, api, pushNotice, saveLatest])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (allowCloseRef.current) {
        return
      }

      const currentDocument = documentRef.current
      if (!currentDocument) {
        return
      }

      const latestContent = readLatestMarkdown()
      if (!dirtyRef.current && latestContent === savedContentRef.current) {
        return
      }

      clearAutosaveTimer()

      try {
        const result = api.flushDocument({
          sessionId: currentDocument.sessionId,
          content: latestContent
        })

        if (result.status === 'saved') {
          savedContentRef.current = latestContent
          dirtyRef.current = false
          return
        }

        event.preventDefault()
        event.returnValue = ''
        setSaveState('error')
        setSaveError(result.message)
        pushNotice({
          kind: 'error',
          title: '保存失败，窗口已保留',
          detail: `${result.message} 你可以重试保存，或放弃本次修改后关闭。`,
          persistent: true,
          actions: [
            {
              label: '重试保存',
              onClick: () => retrySaveRef.current()
            },
            {
              label: '仍然关闭',
              tone: 'danger',
              onClick: forceClose
            }
          ]
        })
      } catch {
        event.preventDefault()
        event.returnValue = ''
        const message = '未能将最后的修改写入文件，请重试。'
        setSaveState('error')
        setSaveError(message)
        pushNotice({
          kind: 'error',
          title: '保存失败，窗口已保留',
          detail: message,
          persistent: true,
          actions: [
            {
              label: '重试保存',
              onClick: () => retrySaveRef.current()
            },
            {
              label: '仍然关闭',
              tone: 'danger',
              onClick: forceClose
            }
          ]
        })
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [api, clearAutosaveTimer, forceClose, pushNotice, readLatestMarkdown])

  useEffect(() => {
    if (!notice || notice.persistent) {
      return
    }

    const timer = window.setTimeout(() => {
      setNotice((currentNotice) => (currentNotice?.id === notice.id ? null : currentNotice))
    }, 4200)

    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    return () => clearAutosaveTimer()
  }, [clearAutosaveTimer])

  const hasUnsavedChanges =
    saveState === 'dirty' || saveState === 'saving' || saveState === 'error'

  return {
    document: activeDocument,
    stats,
    saveState,
    lastSavedAt,
    saveError,
    isOpening,
    hasUnsavedChanges,
    notice,
    dismissNotice: () => setNotice(null),
    openDocument,
    saveNow,
    handleEditorChange,
    registerEditorValueBridge,
    forceClose
  }
}
