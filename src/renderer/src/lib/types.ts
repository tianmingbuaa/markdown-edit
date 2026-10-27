export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export type NoticeKind = 'error' | 'info' | 'success'

export interface NoticeAction {
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
}

export interface Notice {
  id: number
  kind: NoticeKind
  title: string
  detail?: string
  persistent?: boolean
  actions?: NoticeAction[]
}
