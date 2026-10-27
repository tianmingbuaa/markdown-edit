import { Check, Info, TriangleAlert, X } from 'lucide-react'
import type { Notice } from '../lib/types'

interface ToastProps {
  notice: Notice | null
  onDismiss: () => void
}

function ToastIcon({ kind }: Pick<Notice, 'kind'>) {
  if (kind === 'error') {
    return <TriangleAlert size={17} strokeWidth={2} />
  }

  if (kind === 'success') {
    return <Check size={17} strokeWidth={2.2} />
  }

  return <Info size={17} strokeWidth={2} />
}

export function Toast({ notice, onDismiss }: ToastProps) {
  if (!notice) {
    return null
  }

  return (
    <div
      className={`toast toast--${notice.kind}`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
      aria-live={notice.kind === 'error' ? 'assertive' : 'polite'}
    >
      <span className="toast__icon" aria-hidden="true">
        <ToastIcon kind={notice.kind} />
      </span>

      <div className="toast__content">
        <strong className="toast__title">{notice.title}</strong>
        {notice.detail ? <p className="toast__detail">{notice.detail}</p> : null}
        {notice.actions?.length ? (
          <div className="toast__actions">
            {notice.actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className={`toast__action${action.tone === 'danger' ? ' toast__action--danger' : ''}`}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="toast__close"
        onClick={onDismiss}
        aria-label="关闭提示"
        title="关闭提示"
      >
        <X size={14} strokeWidth={1.9} />
      </button>
    </div>
  )
}
