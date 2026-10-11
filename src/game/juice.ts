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
