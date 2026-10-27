import { ArrowRight, FolderOpen, LoaderCircle } from 'lucide-react'

interface WelcomeProps {
  isOpening: boolean
  shortcutModifier: string
  onOpen: () => void
}

export function Welcome({
  isOpening,
  shortcutModifier,
  onOpen
}: WelcomeProps) {
  return (
    <section className="welcome" aria-label="欢迎使用墨页">
      <div className="welcome__copy">
        <p className="welcome__eyebrow">
          <span className="welcome__eyebrow-rule" aria-hidden="true" />
          A quiet place for markdown
        </p>

        <h1 className="welcome__title">
          把想法，
          <br />
          <span className="welcome__accent">
            安静地
            <svg
              className="welcome__underline"
              viewBox="0 0 178 12"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M2 8.6C43 3.4 111 2.2 176 5.7" />
            </svg>
          </span>
          写下来。
        </h1>

        <p className="welcome__lede">
          墨页是一张随时等待你的纸。只专注一个文件，写完即存，
          即时看到文字最终的模样，不让工具打断思路。
        </p>

        <div className="welcome__cta-row">
          <button
            type="button"
            className="primary-button"
            onClick={onOpen}
            disabled={isOpening}
          >
            {isOpening ? (
              <LoaderCircle className="icon-spin" size={17} strokeWidth={2} />
            ) : (
              <FolderOpen size={17} strokeWidth={1.9} />
            )}
            <span>{isOpening ? '正在打开…' : '打开 Markdown 文件'}</span>
            <ArrowRight className="primary-button__arrow" size={16} strokeWidth={1.9} />
          </button>

          <p className="shortcut-hint">
            <kbd>{shortcutModifier}</kbd>
            <span>+</span>
            <kbd>O</kbd>
            <span>随时唤起</span>
          </p>
        </div>

        <ul className="welcome__features" aria-label="产品特点">
          <li>
            <span className="feature-pip" aria-hidden="true" />
            单屏即时渲染
          </li>
          <li>
            <span className="feature-pip" aria-hidden="true" />
            700ms 自动保存
          </li>
          <li>
            <span className="feature-pip" aria-hidden="true" />
            本地优先
          </li>
        </ul>
      </div>

      <div className="welcome__folio" aria-hidden="true">
        <div className="folio-shadow folio-shadow--back" />
        <div className="folio-shadow folio-shadow--middle" />
        <article className="folio-sheet">
          <div className="folio-sheet__grain" />
          <div className="folio-sheet__meta">
            <span>日常札记</span>
            <span>NO. 01</span>
          </div>
          <h2>风穿过松林</h2>
          <p>
            把灵感留在纸上，
            <br />
            让文字自然生长。
          </p>
          <blockquote>
            少一点打扰，
            <br />
            多一点专注。
          </blockquote>
          <div className="folio-sheet__rule" />
          <code>
            <span>const</span> thought = <em>await</em> write()
          </code>
          <div className="folio-sheet__foot">
            <span>墨页</span>
            <span className="folio-sheet__saved">
              <i aria-hidden="true" />
              auto saved
            </span>
          </div>
          <span className="folio-sheet__ribbon" />
        </article>
        <p className="folio-note">专注 · 安静 · 离线可用</p>
      </div>
    </section>
  )
}
