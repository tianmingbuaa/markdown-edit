import {
  Copy,
  FileText,
  FolderOpen,
  LoaderCircle,
  Minus,
  Save,
  Square,
  X
} from 'lucide-react'
import type { SaveState } from '../lib/types'
import { BrandMark } from './BrandMark'

interface TitleBarProps {
  fileName: string | null
  filePath: string | null
  hasUnsavedChanges: boolean
  saveState: SaveState
  isOpening: boolean
  isMaximized: boolean
  shortcutModifier: string
  onOpen: () => void
  onSave: () => void
  onMinimize: () => void
  onToggleMaximize: () => void
  onClose: () => void
}

export function TitleBar({
  fileName,
  filePath,
  hasUnsavedChanges,
  saveState,
  isOpening,
  isMaximized,
  shortcutModifier,
  onOpen,
  onSave,
  onMinimize,
  onToggleMaximize,
  onClose
}: TitleBarProps) {
  const canSave = fileName !== null
  const isSaving = saveState === 'saving'

  return (
    <header className="titlebar">
      <div className="titlebar__leading">
        <div className="titlebar__brand" aria-label="墨页 Inkpage">
          <BrandMark />
          <div className="brand-copy">
            <span className="brand-copy__name">墨页</span>
            <span className="brand-copy__latin">INKPAGE</span>
          </div>
        </div>

        <span className="titlebar__sep" aria-hidden="true" />

        <div className="titlebar__document" title={filePath ?? undefined}>
          <FileText className="titlebar__document-icon" size={14} strokeWidth={1.8} />
          <span className="titlebar__document-name">
            {isOpening ? '正在打开…' : (fileName ?? '未打开文稿')}
          </span>
          {hasUnsavedChanges && !isOpening ? (
            <span
              className={`dirty-dot dirty-dot--${saveState}`}
              title="有等待写入的修改"
              aria-label="有等待写入的修改"
            />
          ) : null}
        </div>
      </div>

      <div className="titlebar__actions">
        <button
          type="button"
          className="title-action"
          onClick={onOpen}
          disabled={isOpening}
          title={`打开 Markdown · ${shortcutModifier}+O`}
        >
          {isOpening ? (
            <LoaderCircle className="icon-spin" size={15} strokeWidth={2} />
          ) : (
            <FolderOpen size={15} strokeWidth={1.9} />
          )}
          <span className="title-action__label">打开</span>
        </button>

        <button
          type="button"
          className="title-action title-action--save"
          onClick={onSave}
          disabled={!canSave}
          title={`立即保存 · ${shortcutModifier}+S`}
        >
          {isSaving ? (
            <LoaderCircle className="icon-spin" size={15} strokeWidth={2} />
          ) : (
            <Save size={15} strokeWidth={1.9} />
          )}
          <span className="title-action__label">{isSaving ? '保存中' : '保存'}</span>
        </button>

        <span className="titlebar__control-sep" aria-hidden="true" />

        <div className="window-controls" aria-label="窗口控制">
          <button
            type="button"
            className="window-control"
            onClick={onMinimize}
            aria-label="最小化窗口"
            title="最小化"
          >
            <Minus size={14} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="window-control"
            onClick={onToggleMaximize}
            aria-label={isMaximized ? '还原窗口' : '最大化窗口'}
            title={isMaximized ? '还原' : '最大化'}
          >
            {isMaximized ? (
              <Copy size={12} strokeWidth={1.9} />
            ) : (
              <Square size={11} strokeWidth={1.9} />
            )}
          </button>
          <button
            type="button"
            className="window-control window-control--close"
            onClick={onClose}
            aria-label="关闭窗口"
            title="关闭"
          >
            <X size={14} strokeWidth={1.9} />
          </button>
        </div>
      </div>
    </header>
  )
}
