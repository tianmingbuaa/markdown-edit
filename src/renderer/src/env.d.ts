/// <reference types="vite/client" />

import type { DesktopApi } from '../../shared/desktop-api'

declare global {
  interface Window {
    inkpage: DesktopApi
  }
}

export {}
