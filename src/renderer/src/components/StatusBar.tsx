import { Check, LoaderCircle, TriangleAlert } from 'lucide-react'
import type { DocumentSnapshot } from '@shared/desktop-api'
import type { SaveState } from '../lib/types'
import type { TextStats } from '../lib/stats'
import { formatClock, formatNumber } from '../lib/stats'

interface StatusBarProps {
  document: DocumentSnapshot | null
  stats: TextStats
  saveState: SaveState
  lastSavedAt: number | null
  saveError: string | null
}

function SaveGlyph({ state }: { state: SaveState }) {
  if (state === 'saving') {
    return <LoaderCircle className="status-glyph icon-spin" size={12} strokeWidth={2.2} />
  }

  if (state === 'saved') {
    return <Check className="status-glyph" size={12} strokeWidth={2.4} />
  }

  if (state === 'error') {
    return <TriangleAlert className="status-glyph" size={12} strokeWidth={2.2} />
  }

  return <span className="status-pip" aria-hidden="true" />
}

function saveLabel(state: SaveState, lastSavedAt: number | null): string {
  switch (state) {
    case 'dirty':
      return '等待保存'
    case 'saving':
      return '正在保存'
    case 'saved':
      return lastSavedAt ? `已自动保存 ${formatClock(lastSavedAt)}` : '自动保存已开启'
    case 'error':
      return '保存失败'
    default:
      return '等待文稿'
  }
}

export function StatusBar({
  document,
  stats,
  saveState,
  lastSavedAt,
  saveError
}: StatusBarProps) {
  return (
    <footer className="statusbar">
      <div className="statusbar__leading">
        <span
          className={`save-status save-status--${saveState}`}
          aria-live="polite"
          title={saveError ?? undefined}
        >
          <SaveGlyph state={saveState} />
          <span>{saveLabel(saveState, lastSavedAt)}</span>
        </span>

        {document ? (
          <>
            <span className="statusbar__divider" aria-hidden="true" />
            <span className="statusbar__path" title={document.path}>
              {document.path}
            </span>
          </>
        ) : null}
      </div>

      <div className="statusbar__trailing">
        {document ? (
          <>
            <span className="statusbar__mode">
              <span className="statusbar__mode-dot" aria-hidden="true" />
              IR 即时渲染
            </span>
            <span className="statusbar__divider" aria-hidden="true" />
            <span className="statusbar__metrics">
              <span>{formatNumber(stats.words)} 字</span>
              <span className="metric-sep">·</span>
              <span>{formatNumber(stats.characters)} 字符</span>
              <span className="metric-sep metric-sep--optional">·</span>
              <span className="metric-optional">{formatNumber(stats.lines)} 行</span>
            </span>
          </>
        ) : (
          <span className="statusbar__metrics">
            <span>Markdown</span>
            <span className="metric-sep">·</span>
            <span>UTF-8</span>
          </span>
        )}
      </div>
    </footer>
  )
}
