/// <reference types="vite/client" />

interface Window {
  __TOKEN?: () => import('./game/types').Match | null
  __BUILD__?: string
  __KO?: {
    setHp: (i: 0 | 1, hp: number) => void
    place: (x0: number, x1: number) => void
    hold: (on: boolean) => void
  }
}
