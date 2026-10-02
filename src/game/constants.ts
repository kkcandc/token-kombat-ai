export const VW = 1280
export const VH = 720
export const GROUND = 500
export const STAGE_LEFT = 160
export const STAGE_RIGHT = 1840
export const GRAV = 0.72
export const JUMP_V = -14.15

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}
