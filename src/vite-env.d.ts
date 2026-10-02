/// <reference types="vite/client" />

interface Window {
  __TOKEN?: () => import('./game/match').Match | null
}
