import { createRoot } from 'react-dom/client'
import '@fontsource-variable/noto-serif-sc'
import 'vditor/dist/index.css'
import './styles/app.css'
import './styles/editor.css'
import { App } from './App'

/**
 * Vditor builds its toolbar with <use> references to an SVG sprite. Load the
 * sprite as an external, CSP-safe script before the first editor mounts instead
 * of letting Vditor inject its own inline <script> (which a strict CSP blocks).
 */
function preloadVditorIconSprite(): void {
  const script = document.createElement('script')
  script.src = new URL('./vditor/dist/js/icons/ant.js', window.location.href).href
  script.async = false
  script.dataset.inkpageIconSprite = 'true'
  script.addEventListener(
    'error',
    () => {
      console.error('[inkpage] Failed to load the Vditor icon sprite.')
    },
    { once: true }
  )
  document.head.appendChild(script)
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('应用挂载节点不存在')
}

preloadVditorIconSprite()
createRoot(rootElement).render(<App />)
