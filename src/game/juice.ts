/**
 * Hit-feel helpers for the coliseum camera.
 * web-demo-juice-kit (github.com/kkcandc/web-demo-juice-kit) is a title stub
 * with no modules, so the rattle lives here and stays deterministic for tests.
 */

const PATTERN = [1, -0.72, 0.55, -1, 0.84, -0.4]

/** Pixels to kick the world while `shake` energy is alive. HUD stays put. */
export function screenShake(shake: number, frame: number, hitstop: number): { x: number; y: number } {
  if (shake < 0.35) return { x: 0, y: 0 }
  const step = hitstop > 0 ? hitstop : frame
  const amp = Math.min(18, shake * 1.15)
  const x = Math.round(PATTERN[step % PATTERN.length] * amp)
  const y = Math.round(PATTERN[(step + 2) % PATTERN.length] * amp * 0.45)
  return { x, y }
}

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t))
}

/**
 * KO slow-mo. `t` is 0 at the killing blow's release and 1 when full speed returns.
 * Starts at 0.15 and eases back to 1 so the tumble reads, then the round catches up.
 * Reduced motion stays at full speed.
 */
export function koTimeScale(t: number, reduceMotion = false): number {
  if (reduceMotion) return 1
  const x = clamp01(t)
  return 0.15 + 0.85 * x * x
}

/** Scale-in for the K.O. stamp. Back-out eases past 1, then the caller holds at 1. */
export function koStampScale(age: number, reduceMotion = false): number {
  if (reduceMotion) return age >= 1 ? 1 : 0
  const dur = 16
  const t = clamp01(age / dur)
  const c = 1.45
  const back = 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
  return Math.max(0, back)
}

/** Little settle-shake once the stamp has landed. HUD and world are not moved. */
export function koStampShake(age: number, reduceMotion = false): { x: number; y: number } {
  if (reduceMotion || age < 8 || age > 22) return { x: 0, y: 0 }
  const damp = 1 - (age - 8) / 14
  const amp = 11 * damp
  return {
    x: Math.round(PATTERN[age % PATTERN.length] * amp),
    y: Math.round(PATTERN[(age + 2) % PATTERN.length] * amp * 0.45),
  }
}

export function koStampAlpha(age: number, life: number): number {
  if (age < 0 || life <= 0 || age >= life) return 0
  const fade = age > life - 12 ? (life - age) / 12 : 1
  return Math.max(0, Math.min(1, fade))
}

/** How far the side camera pushes onto the falling fighter. `zoom` adds to the fit zoom. */
export function koCamera(age: number, beat: number, reduceMotion = false): { zoom: number; bias: number } {
  if (reduceMotion || beat <= 0) return { zoom: 0, bias: 0 }
  const approach = 1 - (1 - clamp01(age / 14)) ** 2
  const release = age < beat ? 1 : Math.max(0, 1 - (age - beat) / 16)
  const k = approach * release
  return { zoom: 0.48 * k, bias: 0.8 * k }
}
