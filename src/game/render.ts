import { GROUND, VH, VW, clamp } from './constants'
import { attackRead } from './match'
import type { FighterDef } from './roster'
import { getFighter } from './roster'
import type { Fighter, Match, Projectile, Spark, State } from './types'

interface Cam {
  mid: number
  zoom: number
}

interface Actor {
  def: FighterDef
  state: State
  stateFrame: number
  anim: number
  crouching: boolean
  flash: number
  shield: number
  facing: 1 | -1
  alpha: number
  recoil: number
  startup: number
  active: number
  recovery: number
}

type Pt = [number, number]

const GROUND_SCREEN = 590

export function renderMatch(ctx: CanvasRenderingContext2D, m: Match, reduceMotion = false, showFrames = false) {
  ctx.clearRect(0, 0, VW, VH)
  drawBackdrop(ctx, m)
  ctx.save()
  if (!reduceMotion) ctx.translate(m.kickX, m.kickY)
  const cam = cameraFor(m, reduceMotion)
  drawFloor(ctx, m, cam)
  for (const z of m.zones) drawZone(ctx, z, cam, m.frame)
  for (const g of m.ghosts) drawGhost(ctx, g, cam)
  for (const f of m.fighters) drawShadow(ctx, f.x, cam)
  for (const c of m.clones) {
    drawShadow(ctx, c.x, cam)
    const def = getFighter(c.defId)
    drawWorld(ctx, cam, c.x, c.y, c.facing, {
      def,
      state: c.hit ? 'hit' : 'punch',
      stateFrame: 8,
      anim: c.life,
      crouching: false,
      flash: 0,
      shield: 0,
      facing: c.facing,
      alpha: 0.55,
      recoil: 0,
      startup: 5,
      active: 3,
      recovery: 10,
    })
  }
  const ordered = [...m.fighters].sort((a, b) => a.y - b.y)
  for (const f of ordered) drawWorld(ctx, cam, f.x, f.y, f.facing, actorFrom(f))
  drawReflections(ctx, cam, m)
  for (const p of m.projectiles) if (p.delay <= 0) drawProjectile(ctx, p, cam, m.frame)
  for (const s of m.sparks) drawSpark(ctx, s, cam)
  if (m.impact > 0.04 && !reduceMotion) drawImpact(ctx, m, cam)
  if (m.bubble) drawBubble(ctx, m.bubble.x, m.bubble.y, m.bubble.text, m.bubble.life, cam)
  if (m.shake > 8 && !reduceMotion) drawSpeedLines(ctx, m)
  ctx.restore()
  drawHud(ctx, m)
  if (showFrames) drawFrameHud(ctx, m)
  if (m.koFlash > 0) {
    ctx.fillStyle = `rgba(255,248,230,${m.koFlash / 22})`
    ctx.fillRect(0, 0, VW, VH)
  } else if (m.impact > 0.05 && !reduceMotion) {
    const wash = [0.1, 0.18, 0.34][m.impactTier] * m.impact
    ctx.fillStyle = `rgba(255,244,226,${wash})`
    ctx.fillRect(0, 0, VW, VH)
  }
  vignette(ctx)
}

export function renderPortrait(ctx: CanvasRenderingContext2D, def: FighterDef, anim: number) {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  ctx.clearRect(0, 0, w, h)
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#2a140f')
  g.addColorStop(0.55, '#140c0c')
  g.addColorStop(1, '#070504')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  const spot = ctx.createRadialGradient(w * 0.5, h * 0.2, 8, w * 0.5, h * 0.45, w * 0.7)
  spot.addColorStop(0, hexA(def.accent, 0.45))
  spot.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = spot
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.beginPath()
  ctx.ellipse(w / 2, h - 18, 36, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.save()
  ctx.translate(w / 2, h - 18)
  ctx.scale(0.62 * def.scale, 0.62 * def.scale)
  drawLocal(ctx, {
    def,
    state: 'idle',
    stateFrame: 0,
    anim,
    crouching: false,
    flash: 0,
    shield: 0,
    facing: 1,
    alpha: 1,
    recoil: 0,
    startup: 0,
    active: 0,
    recovery: 0,
  })
  ctx.restore()
}

function actorFrom(f: Fighter): Actor {
  const read = attackRead(f)
  return {
    def: f.def,
    state: f.state,
    stateFrame: f.stateFrame,
    anim: f.anim,
    crouching: f.crouching && (f.state === 'crouch' || f.state === 'block'),
    flash: f.flash,
    shield: f.shield,
    facing: f.facing,
    alpha: 1,
    recoil: f.recoil,
    startup: read?.startup ?? 0,
    active: read?.active ?? 0,
    recovery: read?.recovery ?? 0,
  }
}

function cameraFor(m: Match, reduceMotion: boolean): Cam {
  const mid = (m.fighters[0].x + m.fighters[1].x) / 2 + (reduceMotion ? 0 : m.panKick)
  const dist = Math.abs(m.fighters[0].x - m.fighters[1].x)
  const base = clamp(1080 / (dist + 460), 0.98, 1.22)
  const zoom = reduceMotion ? base : clamp(base + m.zoomKick, 0.98, 1.46)
  return { mid, zoom }
}

function project(x: number, y: number, cam: Cam) {
  return {
    x: (x - cam.mid) * cam.zoom + VW / 2,
    y: (y - GROUND) * cam.zoom + GROUND_SCREEN,
  }
}

function drawBackdrop(ctx: CanvasRenderingContext2D, m: Match) {
  const sky = ctx.createLinearGradient(0, 0, 0, VH)
  sky.addColorStop(0, '#1a0820')
  sky.addColorStop(0.35, '#3a140c')
  sky.addColorStop(0.62, '#1a0c10')
  sky.addColorStop(1, '#070504')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, VW, VH)

  const key = ctx.createRadialGradient(VW / 2, 120, 20, VW / 2, 420, 560)
  key.addColorStop(0, 'rgba(255, 214, 170, 0.2)')
  key.addColorStop(0.45, 'rgba(255, 78, 42, 0.07)')
  key.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = key
  ctx.fillRect(0, 0, VW, VH)
  ctx.fillStyle = 'rgba(90, 140, 255, 0.05)'
  ctx.fillRect(0, 0, 220, VH)
  ctx.fillStyle = 'rgba(231, 255, 82, 0.04)'
  ctx.fillRect(VW - 220, 0, 220, VH)

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const pulse = 0.35 + Math.sin(m.frame / 18) * 0.08
  for (const [x, color] of [
    [280, `rgba(255,75,43,${pulse})`],
    [1000, `rgba(231,255,82,${pulse * 0.7})`],
  ] as const) {
    const beam = ctx.createLinearGradient(x, 0, x, 520)
    beam.addColorStop(0, color)
    beam.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = beam
    ctx.beginPath()
    ctx.moveTo(x - 18, 0)
    ctx.lineTo(x + 18, 0)
    ctx.lineTo(x + 90, 520)
    ctx.lineTo(x - 90, 520)
    ctx.fill()
  }
  ctx.restore()

  ctx.save()
  ctx.translate(980, 118)
  ctx.strokeStyle = 'rgba(231,255,82,0.55)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(0, 0, 54, 0, Math.PI * 1.4)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,75,43,0.7)'
  ctx.beginPath()
  ctx.arc(0, 0, 68, 1, Math.PI * 1.7)
  ctx.stroke()
  ctx.restore()
  ctx.fillStyle = 'rgba(231,255,82,0.9)'
  ctx.font = '700 64px "Bebas Neue", Impact, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('T', 980, 140)
  ctx.strokeStyle = 'rgba(255,75,43,0.8)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(980, 118, 78, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = '#12080c'
  for (let i = 0; i < 16; i++) {
    const h = 70 + ((i * 53) % 120)
    const x = 20 + i * 80
    ctx.fillRect(x, 300 - h, 54, h)
    ctx.fillStyle = i % 3 === 0 ? '#ff4b2b' : '#e7ff52'
    ctx.globalAlpha = 0.55
    for (let wy = 308 - h; wy < 292; wy += 14) {
      ctx.fillRect(x + 8, wy, 5, 4)
      ctx.fillRect(x + 22, wy + 6, 5, 4)
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = '#12080c'
  }

  drawCrowd(ctx, m.frame)

  ctx.save()
  ctx.shadowColor = '#ff4b2b'
  ctx.shadowBlur = 16
  ctx.fillStyle = 'rgba(246,243,234,0.92)'
  ctx.font = '700 46px "Bebas Neue", Impact, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('TOKEN COLISEUM', VW / 2, 236)
  ctx.restore()

  ctx.strokeStyle = 'rgba(255,75,43,0.9)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.ellipse(VW / 2, 360, 560, 78, 0, Math.PI, 0)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(231,255,82,0.55)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.ellipse(VW / 2, 372, 500, 60, 0, Math.PI, 0)
  ctx.stroke()
}

function drawCrowd(ctx: CanvasRenderingContext2D, frame: number) {
  for (let row = 0; row < 3; row++) {
    const count = 28 - row * 2
    for (let i = 0; i < count; i++) {
      const bob = Math.sin(frame / 9 + i * 0.7 + row) * (row === 0 ? 3 : 2)
      const cheer = Math.sin(frame / 7 + i) > 0.2
      const x = 8 + i * (46 - row * 2) + row * 10
      const y = 292 + row * 28 + bob
      const neon = i % 6 === 0 ? '#ff4b2b' : i % 7 === 0 ? '#e7ff52' : i % 5 === 0 ? '#79e0ff' : '#241816'
      ctx.fillStyle = neon
      ctx.beginPath()
      ctx.arc(x + 7, y - 8, row === 2 ? 5 : 6.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1a100e'
      ctx.fillRect(x + 2, y, 10, 16 + row)
      if (cheer) {
        ctx.strokeStyle = neon
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x + 2, y + 4)
        ctx.lineTo(x - 4, y - 8)
        ctx.moveTo(x + 12, y + 4)
        ctx.lineTo(x + 18, y - 8)
        ctx.stroke()
      }
    }
  }
}

function drawFloor(ctx: CanvasRenderingContext2D, m: Match, cam: Cam) {
  const floor = ctx.createLinearGradient(0, 520, 0, VH)
  floor.addColorStop(0, '#2a1214')
  floor.addColorStop(0.4, '#14080c')
  floor.addColorStop(1, '#050304')
  ctx.fillStyle = floor
  ctx.fillRect(0, 520, VW, VH - 520)

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 540, VW, VH - 540)
  ctx.clip()
  ctx.strokeStyle = 'rgba(231,255,82,0.22)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let wx = 0; wx <= 2100; wx += 64) {
    const a = project(wx, GROUND, cam)
    const b = project(wx, GROUND + 280, cam)
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
  }
  for (let i = 0; i <= 8; i++) {
    const a = project(-100, GROUND + i * 34, cam)
    const b = project(2100, GROUND + i * 34, cam)
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
  }
  ctx.stroke()
  ctx.restore()

  const gloss = ctx.createRadialGradient(VW / 2, 620, 10, VW / 2, 660, 480)
  gloss.addColorStop(0, 'rgba(255, 186, 120, 0.28)')
  gloss.addColorStop(0.45, 'rgba(255, 70, 40, 0.08)')
  gloss.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gloss
  ctx.fillRect(0, 560, VW, 160)

  ctx.save()
  ctx.shadowColor = '#ff4b2b'
  ctx.shadowBlur = 18
  ctx.strokeStyle = 'rgba(255,75,43,0.95)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.ellipse(VW / 2, 628, 390, 28, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(231,255,82,0.7)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(VW / 2, 628, 450, 40, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  ctx.globalAlpha = 0.35 + Math.sin(m.frame / 16) * 0.08
  ctx.fillStyle = '#e7ff52'
  ctx.font = '700 16px "Bebas Neue", Impact, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('TOKEN  ·  COLISEUM  ·  TOKEN', VW / 2, 688)
  ctx.globalAlpha = 1
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, cam: Cam) {
  const p = project(x, GROUND, cam)
  const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 34 * cam.zoom)
  g.addColorStop(0, 'rgba(0,0,0,0.55)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(p.x, p.y + 4, 34 * cam.zoom, 10 * cam.zoom, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawWorld(ctx: CanvasRenderingContext2D, cam: Cam, x: number, y: number, facing: 1 | -1, actor: Actor) {
  const p = project(x, y, cam)
  const z = cam.zoom * actor.def.scale * 1.28
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.scale(facing * z, z)
  if (actor.state === 'ko') ctx.rotate(-1.15)
  else if (actor.state === 'hit' || actor.state === 'launch') ctx.rotate(-0.22 - actor.recoil * 0.012)
  else if (actor.recoil > 0) ctx.rotate(-actor.recoil * 0.01)
  ctx.globalAlpha = actor.alpha
  drawLocal(ctx, actor)
  ctx.restore()
}

function drawReflections(ctx: CanvasRenderingContext2D, cam: Cam, m: Match) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, GROUND_SCREEN + 2, VW, 120)
  ctx.clip()
  ctx.translate(0, GROUND_SCREEN * 2)
  ctx.scale(1, -1)
  ctx.globalAlpha = 0.22
  for (const f of m.fighters) drawWorld(ctx, cam, f.x, f.y, f.facing, { ...actorFrom(f), alpha: 1 })
  ctx.restore()
  const fade = ctx.createLinearGradient(0, GROUND_SCREEN, 0, GROUND_SCREEN + 110)
  fade.addColorStop(0, 'rgba(8,4,6,0)')
  fade.addColorStop(1, 'rgba(5,3,4,0.72)')
  ctx.fillStyle = fade
  ctx.fillRect(0, GROUND_SCREEN, VW, 120)
}

function drawLocal(ctx: CanvasRenderingContext2D, a: Actor) {
  const pose = poseOf(a)
  const bulk = silhouette(a.def)
  ctx.save()
  ctx.translate(pose.shift, pose.bob + pose.crouch)
  if (a.crouching) ctx.scale(1.1, 0.78)
  ctx.rotate(pose.lean)

  const sleeve = a.def.outfit === 'tee' ? a.def.skin : shade(a.def.color, -0.08)
  drawLeg(ctx, pose.backHip, pose.backFoot, false, a, bulk)
  drawArm(ctx, pose.backShoulder, pose.backHand, 13, sleeve, a.def.skin)
  drawTorso(ctx, a, bulk)
  drawLeg(ctx, pose.frontHip, pose.frontFoot, true, a, bulk)
  drawArm(ctx, pose.frontShoulder, pose.frontHand, 14, sleeve, a.def.skin)
  drawHead(ctx, a, bulk)
  drawProp(ctx, a, pose)
  const striking = a.state === 'punch' || a.state === 'kick'
  const live = striking && a.stateFrame > a.startup && a.stateFrame <= a.startup + a.active
  if (a.state === 'punch' && live) drawSlash(ctx, pose.frontHand, a.def.accent, 1.15)
  if (a.state === 'kick' && live) drawSlash(ctx, pose.frontFoot, '#fff6df', 1.45)
  if (a.state === 'special') drawAura(ctx, a)
  if (a.shield > 0) {
    ctx.strokeStyle = a.def.accent
    ctx.globalAlpha = 0.9
    ctx.lineWidth = 5
    ctx.shadowColor = a.def.accent
    ctx.shadowBlur = 18
    ctx.beginPath()
    ctx.ellipse(8, -86, 52, 70, 0.12, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }
  if (a.flash > 0 || a.state === 'hit' || a.state === 'launch') {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const hot = a.flash > 0 ? Math.min(0.85, 0.28 + a.flash / 10) : 0.22
    ctx.fillStyle = `rgba(255,255,255,${hot})`
    ctx.beginPath()
    ctx.ellipse(0, -88, 48, 82, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = Math.min(0.9, hot + 0.2)
    ctx.strokeStyle = a.def.accent
    ctx.lineWidth = 5
    ctx.shadowColor = a.def.accent
    ctx.shadowBlur = 16
    ctx.beginPath()
    ctx.ellipse(0, -88, 50, 84, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()
}

interface BodyPose {
  bob: number
  crouch: number
  lean: number
  shift: number
  backHip: Pt
  frontHip: Pt
  backFoot: Pt
  frontFoot: Pt
  backShoulder: Pt
  frontShoulder: Pt
  backHand: Pt
  frontHand: Pt
}

function limbPhase(fr: number, startup: number, active: number, recovery: number) {
  const su = Math.max(1, startup)
  const act = Math.max(1, active)
  const rec = Math.max(1, recovery)
  if (fr <= su) return -0.42 * ease(fr / su)
  if (fr <= su + act) {
    const t = (fr - su) / act
    return ease(Math.min(1, 0.78 + t * 0.22))
  }
  const t = (fr - su - act) / rec
  return 1 - ease(Math.min(1, t))
}

function poseOf(a: Actor): BodyPose {
  const fr = a.stateFrame
  const softmax = a.def.id === 'altman' && a.state === 'special'
  const punch = a.state === 'punch'
    ? limbPhase(fr, a.startup, a.active, a.recovery)
    : a.state === 'special'
      ? softmax
        ? fr < 9
          ? -0.3 * (fr / 9)
          : fr < 15
            ? 1
            : 1 - ease(Math.min(1, (fr - 15) / 18))
        : 0.9
      : 0
  const kick = a.state === 'kick' ? limbPhase(fr, a.startup, a.active, a.recovery) : 0
  const step = a.state === 'walk' ? Math.sin(a.anim / 3.1) : a.state === 'idle' ? Math.sin(a.anim / 14) * 0.35 : 0
  const bob = a.state === 'idle' ? Math.sin(a.anim / 9) * 3.2 : a.state === 'win' ? -Math.abs(Math.sin(a.anim / 5)) * 10 : 0
  const hurt = a.state === 'hit' || a.state === 'launch'
  const lean =
    (a.state === 'punch' ? 0.12 : a.state === 'kick' ? -0.18 : a.state === 'block' ? -0.06 : hurt ? 0.28 : 0) +
    a.recoil * 0.018
  const guard = a.state === 'block'
  const cheer = a.state === 'win'
  const ko = a.state === 'ko'
  const upper = softmax && fr >= 9 && fr < 15
  const backFoot: Pt = [-18 + step * 18, 0]
  const frontFoot: Pt = [16 - step * 18 + kick * 78, -kick * 28]
  const backHand: Pt = guard ? [2, -124] : cheer ? [-28, -168] : ko ? [-34, -48] : hurt ? [-40, -60] : [-32 - step * 12, -72]
  const frontHand: Pt = guard
    ? [28, -128]
    : cheer
      ? [26, -172]
      : ko
        ? [36, -42]
        : hurt
          ? [8, -70]
          : upper
            ? [18 + punch * 20, -150]
            : [22 + punch * 72, -82 - punch * 8]
  return {
    bob,
    crouch: a.crouching ? 30 : 0,
    lean,
    shift: (a.state === 'walk' ? step * 3 : 0) - (hurt ? 8 : 0) - a.recoil * 0.7,
    backHip: [-14, -64],
    frontHip: [14, -64],
    backFoot,
    frontFoot,
    backShoulder: [-22, -112],
    frontShoulder: [22, -112],
    backHand,
    frontHand,
  }
}

interface Bulk {
  shoulder: number
  hip: number
  hem: number
  head: number
}

function silhouette(def: FighterDef): Bulk {
  switch (def.outfit) {
    case 'leather':
      return { shoulder: 44, hip: 30, hem: -30, head: 26 }
    case 'coat':
      return { shoulder: 32, hip: 26, hem: 8, head: 24 }
    case 'tee':
      return { shoulder: 28, hip: 22, hem: -58, head: 24 }
    case 'blazer':
      return { shoulder: 30, hip: 18, hem: -40, head: 23 }
    case 'suit':
      return { shoulder: 34, hip: 22, hem: -16, head: 24 }
    case 'turtleneck':
      return { shoulder: 36, hip: 26, hem: -42, head: 26 }
    case 'sweater':
      return { shoulder: 40, hip: 28, hem: -36, head: 25 }
    case 'pullover':
      return { shoulder: 36, hip: 26, hem: -34, head: 24 }
    case 'jacket':
      return { shoulder: 32, hip: 22, hem: -32, head: 23 }
    default:
      return { shoulder: 32, hip: 24, hem: -26, head: 24 }
  }
}

function drawLeg(ctx: CanvasRenderingContext2D, hip: Pt, foot: Pt, front: boolean, a: Actor, bulk: Bulk) {
  const knee: Pt = [(hip[0] + foot[0]) / 2 + (front ? 10 : -8), (hip[1] + foot[1]) / 2 + 6]
  const pants = a.def.outfit === 'tee' ? '#2c3342' : shade(a.def.color, front ? -0.35 : -0.5)
  const thigh = a.def.outfit === 'tee' || a.def.outfit === 'leather' ? 16 : bulk.hip > 26 ? 15 : 13
  limb(ctx, hip, knee, thigh, pants)
  limb(ctx, knee, foot, thigh - 3, shade(pants, -0.12))
  ctx.save()
  ctx.translate(foot[0], foot[1] - 2)
  ctx.rotate(front ? 0.15 : -0.1)
  ctx.fillStyle = '#140c08'
  round(ctx, -16, -6, 34, 16, 6)
  ctx.fill()
  ctx.fillStyle = '#1c1814'
  round(ctx, -14, -8, 30, 14, 5)
  ctx.fill()
  ctx.fillStyle = a.def.accent
  ctx.fillRect(-12, -2, 26, 4)
  ctx.restore()
}

function drawArm(ctx: CanvasRenderingContext2D, shoulder: Pt, hand: Pt, r: number, color: string, skin: string) {
  const elbow: Pt = [(shoulder[0] + hand[0]) / 2 + 2, (shoulder[1] + hand[1]) / 2 - 8]
  limb(ctx, shoulder, elbow, r, shade(color, -0.15))
  limb(ctx, elbow, hand, r - 2, color)
  ctx.fillStyle = '#140c08'
  ctx.beginPath()
  ctx.arc(hand[0], hand[1], r * 0.78 + 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = shade(skin, 0.08)
  ctx.beginPath()
  ctx.arc(hand[0], hand[1], r * 0.72, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#140c08'
  ctx.lineWidth = 2
  ctx.stroke()
}

function drawTorso(ctx: CanvasRenderingContext2D, a: Actor, bulk: Bulk) {
  const { shoulder, hip, hem } = bulk
  ctx.beginPath()
  ctx.moveTo(-shoulder, -118)
  ctx.quadraticCurveTo(-shoulder - 10, -78, -hip, hem)
  ctx.quadraticCurveTo(0, hem + 10, hip, hem)
  ctx.quadraticCurveTo(shoulder + 12, -76, shoulder, -118)
  ctx.quadraticCurveTo(0, -132, -shoulder, -118)
  ctx.closePath()
  const g = ctx.createLinearGradient(-shoulder, -120, shoulder, hem)
  g.addColorStop(0, shade(a.def.color, 0.38))
  g.addColorStop(0.42, a.def.color)
  g.addColorStop(1, shade(a.def.color, -0.42))
  ctx.fillStyle = g
  ctx.fill()
  ctx.lineWidth = 5
  ctx.strokeStyle = '#140c08'
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  ctx.beginPath()
  ctx.ellipse(-shoulder * 0.28, -100, 10, 16, -0.4, 0, Math.PI * 2)
  ctx.fill()
  if (a.def.outfit === 'suit') {
    ctx.fillStyle = '#f7f3ea'
    ctx.beginPath()
    ctx.moveTo(-6, -116)
    ctx.lineTo(8, hem + 6)
    ctx.lineTo(-10, hem + 6)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = a.def.accent
    ctx.beginPath()
    ctx.moveTo(0, -108)
    ctx.lineTo(5, -70)
    ctx.lineTo(-5, -70)
    ctx.closePath()
    ctx.fill()
  } else if (a.def.outfit === 'zip' || a.def.outfit === 'pullover' || a.def.outfit === 'sweater') {
    ctx.strokeStyle = shade(a.def.color, 0.45)
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, -114)
    ctx.lineTo(0, hem + 2)
    ctx.stroke()
    ctx.fillStyle = a.def.accent
    ctx.beginPath()
    ctx.arc(0, -96, 4, 0, Math.PI * 2)
    ctx.fill()
  } else if (a.def.outfit === 'turtleneck') {
    ctx.fillStyle = shade(a.def.color, 0.2)
    round(ctx, -14, -128, 28, 22, 8)
    ctx.fill()
    ctx.strokeStyle = '#140c08'
    ctx.lineWidth = 3
    ctx.stroke()
  } else if (a.def.outfit === 'leather') {
    ctx.strokeStyle = hexA(a.def.accent, 0.85)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-18, -86)
    ctx.quadraticCurveTo(0, -78, 20, -90)
    ctx.moveTo(-16, -70)
    ctx.quadraticCurveTo(4, -62, 22, -74)
    ctx.stroke()
    ctx.fillStyle = a.def.accent
    round(ctx, -8, -108, 16, 8, 2)
    ctx.fill()
  } else if (a.def.outfit === 'blazer' || a.def.outfit === 'jacket' || a.def.outfit === 'coat') {
    ctx.strokeStyle = shade(a.def.color, 0.4)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, -116)
    ctx.lineTo(-6, hem)
    ctx.moveTo(0, -116)
    ctx.lineTo(8, hem)
    ctx.stroke()
    ctx.fillStyle = a.def.accent
    ctx.fillRect(-shoulder * 0.55, -108, 8, 18)
  } else if (a.def.outfit === 'tee') {
    ctx.fillStyle = a.def.accent
    ctx.font = '700 14px "Bebas Neue", Impact, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(a.def.prop === 'llama' ? 'LL' : '</>', 2, -88)
  }
}

function drawHead(ctx: CanvasRenderingContext2D, a: Actor, bulk: Bulk) {
  const r = bulk.head
  const cy = -128
  const hit = a.state === 'hit' || a.state === 'launch' || a.state === 'ko'
  ctx.save()
  if (hit || a.recoil > 0) ctx.translate(-4 - a.recoil * 0.35, hit ? -3 : 0)
  limb(ctx, [0, -112], [0, cy + r * 0.35], 8, a.def.skin)
  const head = ctx.createRadialGradient(-8, cy - 6, 4, 2, cy, r + 4)
  head.addColorStop(0, shade(a.def.skin, 0.28))
  head.addColorStop(0.7, a.def.skin)
  head.addColorStop(1, shade(a.def.skin, -0.22))
  ctx.fillStyle = '#140c08'
  ctx.beginPath()
  ctx.arc(0, cy, r + 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = head
  ctx.beginPath()
  ctx.arc(0, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = shade(a.def.skin, -0.1)
  ctx.beginPath()
  ctx.ellipse(-r * 0.82, cy + 2, 5, 7, 0, 0, Math.PI * 2)
  ctx.ellipse(r * 0.82, cy + 2, 5, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  drawHair(ctx, a.def, r, cy)
  const win = a.state === 'win'
  const eyeY = cy - 2
  if (a.state === 'ko') {
    ctx.strokeStyle = '#1a120e'
    ctx.lineWidth = 2.4
    xEye(ctx, -7, eyeY)
    xEye(ctx, 7, eyeY)
  } else if (hit) {
    ctx.strokeStyle = '#1a120e'
    ctx.lineWidth = 2.6
    ctx.beginPath()
    ctx.moveTo(-12, eyeY)
    ctx.lineTo(-3, eyeY)
    ctx.moveTo(4, eyeY)
    ctx.lineTo(13, eyeY)
    ctx.stroke()
  } else {
    ctx.fillStyle = '#1a120e'
    ctx.beginPath()
    ctx.ellipse(-7, eyeY, 3.1, win ? 1.6 : 3.6, 0, 0, Math.PI * 2)
    ctx.ellipse(7, eyeY, 3.1, win ? 1.6 : 3.6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(-6, eyeY - 1.2, 1.1, 0, Math.PI * 2)
    ctx.arc(8, eyeY - 1.2, 1.1, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = '#1a120e'
  ctx.lineWidth = 2
  ctx.beginPath()
  if (win) ctx.arc(0, cy + 8, 7, 0.15, Math.PI - 0.15)
  else if (hit) ctx.arc(0, cy + 12, 5, Math.PI + 0.4, -0.4)
  else ctx.arc(0, cy + 8, 5.5, 0.2, Math.PI - 0.2)
  ctx.stroke()
  if (a.def.glasses) {
    ctx.strokeStyle = a.def.hair === 'silver' ? '#d7ffe0' : '#16120f'
    ctx.lineWidth = 2.4
    round(ctx, -18, eyeY - 7, 15, 12, 3)
    ctx.stroke()
    round(ctx, 3, eyeY - 7, 15, 12, 3)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-3, eyeY - 1)
    ctx.lineTo(3, eyeY - 1)
    ctx.stroke()
  }
  ctx.restore()
}

function xEye(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath()
  ctx.moveTo(x - 3, y - 3)
  ctx.lineTo(x + 3, y + 3)
  ctx.moveTo(x + 3, y - 3)
  ctx.lineTo(x - 3, y + 3)
  ctx.stroke()
}

function drawHair(ctx: CanvasRenderingContext2D, def: FighterDef, r: number, cy: number) {
  ctx.fillStyle = def.hairColor
  ctx.strokeStyle = '#140c08'
  ctx.lineWidth = 3
  if (def.hair === 'buzz') {
    ctx.beginPath()
    ctx.ellipse(0, cy - r * 0.55, r * 0.92, r * 0.42, 0, Math.PI, 0)
    ctx.fill()
    return
  }
  if (def.hair === 'bob') {
    ctx.beginPath()
    ctx.arc(0, cy, r + 3, Math.PI * 1.02, Math.PI * 1.98)
    ctx.quadraticCurveTo(r + 8, cy + 18, r - 2, cy + 36)
    ctx.lineTo(-r + 2, cy + 36)
    ctx.quadraticCurveTo(-r - 8, cy + 16, -r - 2, cy)
    ctx.fill()
    ctx.stroke()
    return
  }
  if (def.hair === 'curly') {
    const big = def.id === 'ilya' ? 11 : def.id === 'zuck' ? 8 : 7
    const puffs: Pt[] = [
      [0, cy - r - 8],
      [-14, cy - r],
      [14, cy - r],
      [-r, cy - 4],
      [r, cy - 4],
      [-8, cy - r + 4],
      [8, cy - r - 6],
      [0, cy - r + 8],
    ]
    for (const [x, y] of puffs) {
      ctx.beginPath()
      ctx.arc(x, y, big, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    return
  }
  if (def.hair === 'wavy') {
    const long = def.id === 'feifei'
    ctx.beginPath()
    ctx.moveTo(-r, cy + 4)
    ctx.quadraticCurveTo(-10, cy - r - 22, 10, cy - r - 4)
    ctx.quadraticCurveTo(r + 10, cy - 8, r + 2, cy + (long ? 48 : 28))
    ctx.quadraticCurveTo(6, cy + 8, 2, cy - 6)
    ctx.quadraticCurveTo(-8, cy - r - 8, -r, cy + 4)
    ctx.fill()
    ctx.stroke()
    return
  }
  if (def.hair === 'side' || def.hair === 'silver') {
    ctx.beginPath()
    ctx.moveTo(-r, cy - 2)
    ctx.quadraticCurveTo(-8, cy - r - 24, r * 0.7, cy - r - 2)
    ctx.quadraticCurveTo(r + 12, cy - 10, r * 0.4, cy - 2)
    ctx.quadraticCurveTo(0, cy - r, -r, cy - 2)
    ctx.fill()
    ctx.stroke()
    return
  }
  ctx.beginPath()
  ctx.ellipse(0, cy - r * 0.72, r * 0.95, r * 0.48, 0, Math.PI, 0)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-4, cy - r - 2, 8, 5, -0.5, 0, Math.PI * 2)
  ctx.fill()
}

function drawProp(ctx: CanvasRenderingContext2D, a: Actor, pose: BodyPose) {
  const c = a.def.accent
  ctx.save()
  ctx.shadowColor = c
  ctx.shadowBlur = 12
  if (a.def.prop === 'halo') {
    ctx.strokeStyle = c
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.ellipse(0, -152, 20, 7, Math.sin(a.anim / 12) * 0.2, 0, Math.PI * 2)
    ctx.stroke()
  } else if (a.def.prop === 'rocket') {
    ctx.translate(-28, -88)
    ctx.rotate(-0.9)
    ctx.fillStyle = c
    ctx.fillRect(-6, 0, 12, 28)
    ctx.beginPath()
    ctx.moveTo(-6, 0)
    ctx.lineTo(0, -12)
    ctx.lineTo(6, 0)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#f6f3ea'
    ctx.fillRect(-3, 8, 6, 8)
    ctx.fillStyle = '#e7ff52'
    ctx.beginPath()
    ctx.moveTo(-4, 28)
    ctx.lineTo(0, 40 + Math.sin(a.anim) * 3)
    ctx.lineTo(4, 28)
    ctx.fill()
  } else if (a.def.prop === 'chip') {
    ctx.strokeStyle = c
    ctx.lineWidth = 2
    ctx.strokeRect(-10, -78, 22, 16)
    ctx.beginPath()
    ctx.moveTo(-6, -74)
    ctx.lineTo(8, -70)
    ctx.lineTo(4, -66)
    ctx.stroke()
  } else if (a.def.prop === 'stone') {
    const ang = a.anim / 10
    ctx.shadowBlur = 0
    ctx.fillStyle = '#f7f4ee'
    ctx.beginPath()
    ctx.arc(Math.cos(ang) * 28, -80 + Math.sin(ang) * 10, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#111'
    ctx.beginPath()
    ctx.arc(Math.cos(ang + 2.2) * 26, -64 + Math.sin(ang) * 8, 6, 0, Math.PI * 2)
    ctx.fill()
  } else if (a.def.prop === 'shield') {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.moveTo(pose.frontHand[0] + 8, pose.frontHand[1] - 16)
    ctx.lineTo(pose.frontHand[0] + 22, pose.frontHand[1] - 6)
    ctx.lineTo(pose.frontHand[0] + 16, pose.frontHand[1] + 12)
    ctx.lineTo(pose.frontHand[0] + 4, pose.frontHand[1] + 16)
    ctx.lineTo(pose.frontHand[0] - 4, pose.frontHand[1] + 6)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#140c08'
    ctx.lineWidth = 2
    ctx.stroke()
  } else if (a.def.prop === 'prism') {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.moveTo(30, -110)
    ctx.lineTo(48, -82)
    ctx.lineTo(26, -74)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.beginPath()
    ctx.moveTo(32, -102)
    ctx.lineTo(40, -86)
    ctx.lineTo(30, -84)
    ctx.closePath()
    ctx.fill()
  } else if (a.def.prop === 'spark') {
    star(ctx, 0, -150, 8 + Math.sin(a.anim / 4) * 2, c)
  } else if (a.def.prop === 'llama') {
    ctx.shadowBlur = 0
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.ellipse(26, -100, 11, 7, 0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(20, -110, 3, 6, -0.4, 0, Math.PI * 2)
    ctx.ellipse(28, -112, 3, 6, 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1a120e'
    ctx.beginPath()
    ctx.arc(32, -100, 1.3, 0, Math.PI * 2)
    ctx.fill()
  } else if (a.def.prop === 'drone') {
    const y = -128 + Math.sin(a.anim / 7) * 4
    drone(ctx, -32, y, c)
    drone(ctx, 28, y + 10, c)
  } else if (a.def.prop === 'crystal') {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.moveTo(28, -108)
    ctx.lineTo(42, -86)
    ctx.lineTo(28, -66)
    ctx.lineTo(16, -86)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.beginPath()
    ctx.moveTo(28, -100)
    ctx.lineTo(34, -86)
    ctx.lineTo(28, -78)
    ctx.closePath()
    ctx.fill()
  } else if (a.def.prop === 'cake') {
    ctx.shadowBlur = 0
    ctx.fillStyle = '#5c3317'
    ctx.fillRect(18, -70, 22, 14)
    ctx.fillStyle = c
    ctx.fillRect(18, -76, 22, 8)
    ctx.fillStyle = '#fff'
    ctx.fillRect(18, -72, 22, 3)
    ctx.fillStyle = '#ff4b2b'
    ctx.fillRect(27, -84, 3, 8)
  } else if (a.def.prop === 'code') {
    ctx.fillStyle = c
    ctx.font = '700 16px "Sora", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('</>', 34, -78 + Math.sin(a.anim / 8) * 3)
  }
  ctx.restore()
}

function drone(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color
  round(ctx, x, y, 16, 7, 3)
  ctx.fill()
  ctx.fillStyle = '#111'
  ctx.fillRect(x + 6, y + 2, 4, 3)
}

function drawAura(ctx: CanvasRenderingContext2D, a: Actor) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const spin = a.anim / 5
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = i === 1 ? '#fff' : a.def.accent
    ctx.globalAlpha = 0.35 + i * 0.15
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.ellipse(0, -90, 36 + i * 14, 58 + i * 10, spin + i, 0, Math.PI * 1.6)
    ctx.stroke()
  }
  star(ctx, Math.cos(spin) * 40, -90 + Math.sin(spin) * 30, 8, a.def.accent)
  ctx.restore()
}

function drawSlash(ctx: CanvasRenderingContext2D, at: Pt, color: string, scale: number) {
  ctx.save()
  ctx.translate(at[0], at[1])
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = hexA(color, 0.35)
  ctx.beginPath()
  ctx.arc(-4, 2, 46 * scale, -1.2, 1.25)
  ctx.arc(-10, 8, 16 * scale, 1.25, -1.2, true)
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.globalAlpha = 0.9
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.shadowColor = color
  ctx.shadowBlur = 16
  ctx.beginPath()
  ctx.arc(-4, 2, 22 * scale, -1.05, 1.05)
  ctx.stroke()
  star(ctx, 16 * scale, -6, 7, color)
  star(ctx, 8, 14 * scale, 5, '#fff')
  ctx.restore()
}

function limb(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, r: number, color: string) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  ctx.save()
  ctx.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
  ctx.rotate(ang)
  ctx.fillStyle = '#140c08'
  ctx.beginPath()
  ctx.ellipse(0, 0, len / 2 + 2, r + 3.5, 0, 0, Math.PI * 2)
  ctx.fill()
  const g = ctx.createLinearGradient(0, -r, 0, r)
  g.addColorStop(0, shade(color, 0.42))
  g.addColorStop(0.5, color)
  g.addColorStop(1, shade(color, -0.38))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(0, 0, Math.max(1, len / 2), r, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawGhost(ctx: CanvasRenderingContext2D, g: { x: number; y: number; life: number; color: string }, cam: Cam) {
  const p = project(g.x, g.y, cam)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = g.life / 12
  ctx.fillStyle = g.color
  ctx.beginPath()
  ctx.ellipse(p.x, p.y - 70 * cam.zoom, 18 * cam.zoom, 48 * cam.zoom, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawZone(
  ctx: CanvasRenderingContext2D,
  z: { kind: string; x: number; r: number; life: number },
  cam: Cam,
  frame: number,
) {
  const p = project(z.x, GROUND, cam)
  ctx.save()
  ctx.translate(p.x, p.y)
  if (z.kind === 'slow') {
    ctx.strokeStyle = 'rgba(244,241,234,0.85)'
    ctx.shadowColor = '#fff'
    ctx.shadowBlur = 8
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(0, 0, z.r * cam.zoom, z.r * cam.zoom * 0.38, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 0.45
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath()
      ctx.ellipse(0, i * 10, (z.r - 16) * cam.zoom, 8, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else if (z.kind === 'snare') {
    ctx.strokeStyle = '#ffd0e0'
    ctx.shadowColor = '#ffd0e0'
    ctx.shadowBlur = 12
    ctx.lineWidth = 3
    ctx.globalAlpha = 0.65 + Math.sin(frame / 5) * 0.25
    ctx.beginPath()
    ctx.ellipse(0, 0, z.r * cam.zoom, z.r * cam.zoom * 0.36, 0, 0, Math.PI * 2)
    ctx.stroke()
    diamond(ctx, 0, -6, 14)
  } else {
    ctx.fillStyle = '#ffb7d5'
    ctx.globalAlpha = 0.55
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      ctx.ellipse(Math.cos(i) * 28 * cam.zoom, Math.sin(i) * 8, 18, 8, i, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, cam: Cam, frame: number) {
  const pos = project(p.x, p.y, cam)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  if (p.kind !== 'beam' && p.kind !== 'cloud') {
    for (let i = 3; i >= 1; i--) {
      ctx.globalAlpha = 0.12 * i
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(pos.x - p.vx * i * 1.6, pos.y - p.vy * i * 1.6, 6 * cam.zoom, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
  ctx.translate(pos.x, pos.y)
  const s = cam.zoom
  if (p.kind === 'beam') {
    ctx.scale(p.facing, 1)
    ctx.fillStyle = 'rgba(125,255,106,0.28)'
    ctx.fillRect(-8, -22 * s, p.w * s, 44 * s)
    const g = ctx.createLinearGradient(0, 0, p.w * s, 0)
    g.addColorStop(0, 'rgba(255,255,255,0.95)')
    g.addColorStop(0.15, '#d8ffbf')
    g.addColorStop(1, 'rgba(125,255,106,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, -7 * s, p.w * s, 14 * s)
    ctx.restore()
    return
  }
  ctx.shadowBlur = 16
  if (p.kind === 'orb') {
    ctx.shadowColor = '#7ee0ff'
    ctx.fillStyle = '#e9fbff'
    ctx.beginPath()
    ctx.arc(0, 0, 8 * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(126,224,255,0.45)'
    ctx.beginPath()
    ctx.arc(0, 0, 16 * s, 0, Math.PI * 2)
    ctx.fill()
  } else if (p.kind === 'rocket') {
    ctx.rotate(Math.atan2(p.vy, p.vx))
    ctx.shadowColor = '#ff8a3d'
    ctx.fillStyle = '#ffb067'
    ctx.fillRect(-18 * s, -6 * s, 30 * s, 12 * s)
    ctx.beginPath()
    ctx.moveTo(12 * s, -6 * s)
    ctx.lineTo(26 * s, 0)
    ctx.lineTo(12 * s, 6 * s)
    ctx.fill()
    ctx.fillStyle = '#e7ff52'
    ctx.beginPath()
    ctx.moveTo(-18 * s, -4 * s)
    ctx.lineTo(-30 * s - (frame % 5), 0)
    ctx.lineTo(-18 * s, 4 * s)
    ctx.fill()
  } else if (p.kind === 'stone') {
    ctx.shadowBlur = 0
    ctx.fillStyle = frame % 14 < 7 ? '#f7f4ee' : '#161616'
    ctx.beginPath()
    ctx.arc(0, 0, 10 * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = frame % 14 < 7 ? '#161616' : '#f7f4ee'
    ctx.lineWidth = 2
    ctx.stroke()
  } else if (p.kind === 'llama') {
    ctx.shadowBlur = 0
    ctx.fillStyle = '#7eb6ff'
    ctx.beginPath()
    ctx.ellipse(0, 0, 16 * s, 10 * s, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(-7 * s, -10 * s, 3 * s, 6 * s, 0, 0, Math.PI * 2)
    ctx.ellipse(5 * s, -10 * s, 3 * s, 6 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (p.kind === 'shot' || p.kind === 'drone') {
    ctx.shadowColor = '#9fd6ff'
    ctx.fillStyle = p.kind === 'drone' ? '#f4fbff' : '#b9ecff'
    round(ctx, -10 * s, -5 * s, 20 * s, 10 * s, 4)
    ctx.fill()
  } else if (p.kind === 'cloud') {
    ctx.shadowColor = '#d7ecff'
    ctx.fillStyle = 'rgba(230,244,255,0.95)'
    ctx.beginPath()
    ctx.ellipse(0, 0, 60 * s, 26 * s, 0, 0, Math.PI * 2)
    ctx.ellipse(-34 * s, 8 * s, 30 * s, 16 * s, 0, 0, Math.PI * 2)
    ctx.ellipse(32 * s, 10 * s, 26 * s, 14 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (p.kind === 'crystal') {
    ctx.shadowColor = '#ffd0e0'
    ctx.fillStyle = '#ffe4ef'
    diamond(ctx, 0, 0, 16 * s)
    ctx.fillStyle = '#ff8fb8'
    diamond(ctx, 0, 2 * s, 8 * s)
  } else if (p.kind === 'cake') {
    ctx.shadowBlur = 0
    ctx.fillStyle = '#ffd0e4'
    ctx.fillRect(-16 * s, -10 * s, 32 * s, 18 * s)
    ctx.fillStyle = '#fff'
    ctx.fillRect(-16 * s, -4 * s, 32 * s, 4 * s)
    ctx.fillStyle = '#ff4b2b'
    ctx.fillRect(-2 * s, -18 * s, 4 * s, 10 * s)
  } else if (p.kind === 'glyph') {
    ctx.shadowColor = '#b6ff4a'
    ctx.fillStyle = '#eaffb0'
    ctx.font = `700 ${18 * s}px "Sora", sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(['{ }', '∇', 'λ', '01', '</>'][Math.abs(p.phase) % 5], 0, 6 * s)
  }
  ctx.restore()
}

function drawSpark(ctx: CanvasRenderingContext2D, s: Spark, cam: Cam) {
  const p = project(s.x, s.y, cam)
  const t = s.life / s.max
  ctx.save()
  ctx.globalAlpha = Math.max(0, t)
  ctx.translate(p.x, p.y)
  if (s.kind === 'text' && s.text) {
    ctx.font = '700 22px "Bebas Neue", Impact, sans-serif'
    ctx.textAlign = 'center'
    ctx.lineWidth = 4
    ctx.strokeStyle = '#140c08'
    ctx.strokeText(s.text, 0, 0)
    ctx.fillStyle = s.color
    ctx.fillText(s.text, 0, 0)
  } else if (s.kind === 'ring') {
    ctx.strokeStyle = s.color
    ctx.lineWidth = 4
    ctx.shadowColor = s.color
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.arc(0, 0, (1 - t) * (s.size + 28) + 8, 0, Math.PI * 2)
    ctx.stroke()
  } else if (s.kind === 'streak') {
    ctx.rotate(s.rot)
    ctx.fillStyle = s.color
    ctx.shadowColor = s.color
    ctx.shadowBlur = 8
    ctx.fillRect(-s.size * 2.4, -1.6, s.size * 4.8, 3.2)
  } else if (s.kind === 'shard') {
    ctx.rotate(s.rot)
    ctx.fillStyle = s.color
    ctx.beginPath()
    ctx.moveTo(0, -s.size * 1.4)
    ctx.lineTo(s.size * 0.45, s.size)
    ctx.lineTo(-s.size * 0.45, s.size)
    ctx.closePath()
    ctx.fill()
  } else if (s.kind === 'flash') {
    const rad = s.size * (0.72 + t * 0.45)
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, rad)
    g.addColorStop(0, 'rgba(255,255,255,0.95)')
    g.addColorStop(0.35, s.color)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, rad, 0, Math.PI * 2)
    ctx.fill()
  } else {
    star(ctx, 0, 0, s.size + 3, s.color)
  }
  ctx.restore()
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, life: number, cam: Cam) {
  const p = project(x, y, cam)
  ctx.save()
  ctx.globalAlpha = Math.min(1, life / 10)
  ctx.translate(p.x, p.y)
  ctx.fillStyle = '#f6f3ea'
  ctx.strokeStyle = '#ff4b2b'
  ctx.lineWidth = 3
  round(ctx, -96, -20, 192, 36, 10)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#1a100e'
  ctx.font = '700 13px "Sora", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(text, 0, 4)
  ctx.restore()
}

function drawHud(ctx: CanvasRenderingContext2D, m: Match) {
  const left = m.fighters[0]
  const right = m.fighters[1]
  plate(ctx, 28, 28, 460, left, false, m.frame)
  plate(ctx, VW - 28 - 460, 28, 460, right, true, m.frame)

  ctx.save()
  ctx.translate(VW / 2, 58)
  ctx.fillStyle = '#140c0c'
  ctx.strokeStyle = '#e7ff52'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, -28)
  ctx.lineTo(26, -14)
  ctx.lineTo(26, 14)
  ctx.lineTo(0, 28)
  ctx.lineTo(-26, 14)
  ctx.lineTo(-26, -14)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#f6f3ea'
  ctx.font = '700 28px "Bebas Neue", Impact, sans-serif'
  ctx.textAlign = 'center'
  const secs = Math.max(0, Math.ceil(m.timer / 60))
  ctx.fillText(m.phase === 'fight' ? String(secs).padStart(2, '0') : '••', 0, 8)
  ctx.restore()

  const big = m.phase !== 'fight'
  const showCall = m.callout && m.calloutT > 0 && m.phase === 'fight'
  if (big || showCall) {
    const pop = 1 + Math.min(0.16, (m.calloutT || 0) / 180)
    const by = big ? 168 : 124
    ctx.save()
    ctx.translate(VW / 2, by)
    ctx.scale(pop, pop)
    ctx.fillStyle = 'rgba(8,5,4,0.78)'
    ctx.strokeStyle = big && m.phase === 'matchend' ? '#ff4b2b' : '#e7ff52'
    ctx.lineWidth = 3
    const bw = big ? 780 : 520
    const bh = big ? 108 : 48
    round(ctx, -bw / 2, 0, bw, bh, 6)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#e7ff52'
    ctx.font = big ? '700 52px "Bebas Neue", Impact, sans-serif' : '700 26px "Bebas Neue", Impact, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(big ? m.banner : m.callout, 0, big ? 48 : 32)
    if (big) {
      ctx.fillStyle = '#f6f3ea'
      ctx.font = '600 16px "Sora", sans-serif'
      ctx.fillText(m.sub, 0, 82)
    }
    ctx.restore()
  }
  if (m.phase === 'intro') {
    ctx.font = '700 34px "Bebas Neue", Impact, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = left.def.accent
    ctx.fillText(left.def.last, 48, 250)
    ctx.textAlign = 'right'
    ctx.fillStyle = right.def.accent
    ctx.fillText(right.def.last, VW - 48, 250)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#f6f3ea'
    ctx.fillText('VS', VW / 2, 250)
  }
  if (m.phase === 'fight' && m.frame < 220 && m.hitstop === 0) {
    ctx.textAlign = 'center'
    ctx.font = '600 13px "Sora", sans-serif'
    ctx.fillStyle = 'rgba(246,243,234,0.8)'
    const hint =
      m.mode === 'local'
        ? 'P1  J K L I     ·     P2  N M , .'
        : 'WASD or arrows  ·  J punch  ·  K kick  ·  L special  ·  I block'
    ctx.fillText(hint, VW / 2, 148)
  }
}

function plate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, f: Fighter, mirror: boolean, frame: number) {
  ctx.textAlign = mirror ? 'right' : 'left'
  ctx.fillStyle = f.def.accent
  ctx.fillRect(mirror ? x + w - 46 : x, y - 18, 46, 4)
  ctx.fillStyle = '#f6f3ea'
  ctx.font = '700 26px "Bebas Neue", Impact, sans-serif'
  ctx.fillText(f.def.last, mirror ? x + w : x, y - 2)
  ctx.fillStyle = '#1a100e'
  ctx.strokeStyle = 'rgba(246,243,234,0.35)'
  ctx.lineWidth = 2
  round(ctx, x, y + 6, w, 18, 3)
  ctx.fill()
  ctx.stroke()
  const pct = clamp(f.hp / 100, 0, 1)
  const danger = f.hp < 30 && Math.sin(frame / 4) > 0
  ctx.fillStyle = danger ? '#ff4b2b' : f.def.accent
  const fw = Math.max(0, (w - 6) * pct)
  ctx.save()
  ctx.beginPath()
  round(ctx, x + 3, y + 9, w - 6, 12, 2)
  ctx.clip()
  if (mirror) ctx.fillRect(x + w - 3 - fw, y + 9, fw, 12)
  else ctx.fillRect(x + 3, y + 9, fw, 12)
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.fillRect(x + 3, y + 9, w - 6, 4)
  ctx.restore()

  ctx.fillStyle = '#1a100e'
  round(ctx, x, y + 30, 210, 10, 2)
  ctx.fill()
  const mp = clamp(f.meter / 100, 0, 1)
  const mw = 204 * mp
  ctx.fillStyle = mp >= 1 ? '#e7ff52' : '#f4efe4'
  if (mp >= 1) {
    ctx.shadowColor = '#e7ff52'
    ctx.shadowBlur = 8
  }
  if (mirror) round(ctx, x + 210 - 3 - mw, y + 32, mw, 6, 1)
  else round(ctx, x + 3, y + 32, mw, 6, 1)
  ctx.fill()
  ctx.shadowBlur = 0

  for (let i = 0; i < 2; i++) {
    const px = mirror ? x + w - 16 - i * 18 : x + i * 18
    ctx.beginPath()
    ctx.arc(px + 6, y + 54, 6, 0, Math.PI * 2)
    ctx.strokeStyle = f.def.accent
    ctx.lineWidth = 2
    ctx.stroke()
    if (i < f.wins) {
      ctx.fillStyle = '#e7ff52'
      ctx.fill()
    }
  }
  if (f.chain >= 2 && f.chainTimer > 0) {
    ctx.font = '700 16px "Bebas Neue", Impact, sans-serif'
    ctx.fillStyle = '#e7ff52'
    ctx.fillText(`${f.chain}-HIT CHAIN`, mirror ? x + w : x, y + 74)
  }
}

function drawImpact(ctx: CanvasRenderingContext2D, m: Match, cam: Cam) {
  const p = project(m.impactX, m.impactY, cam)
  const rad = [36, 62, 96][m.impactTier] * (0.85 + m.impact * 0.35)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = Math.min(1, m.impact)
  const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, rad)
  g.addColorStop(0, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.4, 'rgba(255,220,160,0.45)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(p.x, p.y, rad, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawFrameHud(ctx: CanvasRenderingContext2D, m: Match) {
  const lines: string[] = []
  for (const f of m.fighters) {
    const read = attackRead(f)
    if (!read) continue
    const tag = read.cancel && read.phase !== 'STARTUP' ? '  CANCEL' : ''
    lines.push(`${f.def.last}  ${read.name}  f${read.now}  ${read.phase}${tag}`)
    lines.push(`SU ${read.startup}   ACT ${read.active}   REC ${read.recovery}`)
  }
  if (m.hitstop > 0) lines.push(`HIT STOP ${m.hitstop}`)
  if (m.lastAdvT > 0) {
    const sign = m.lastAdv > 0 ? '+' : ''
    lines.push(`FRAME ADV  ${sign}${m.lastAdv}`)
  }
  if (!lines.length) lines.push('FRAME DATA  ·  idle')
  ctx.save()
  ctx.font = '700 16px "Bebas Neue", Impact, sans-serif'
  const w = 280
  const h = 16 + lines.length * 20
  ctx.translate(36, 118)
  ctx.fillStyle = 'rgba(8,5,4,0.82)'
  ctx.strokeStyle = '#e7ff52'
  ctx.lineWidth = 2
  round(ctx, 0, 0, w, h, 4)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#f6f3ea'
  ctx.textAlign = 'left'
  lines.forEach((line, i) => {
    ctx.fillStyle = line.startsWith('FRAME ADV') || line.startsWith('HIT STOP') ? '#e7ff52' : '#f6f3ea'
    ctx.fillText(line, 12, 22 + i * 20)
  })
  ctx.restore()
}

function drawSpeedLines(ctx: CanvasRenderingContext2D, m: Match) {
  ctx.save()
  ctx.globalAlpha = Math.min(0.35, m.shake / 40)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  const cx = VW / 2
  const cy = 430
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + m.frame
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * 180, cy + Math.sin(a) * 80)
    ctx.lineTo(cx + Math.cos(a) * 420, cy + Math.sin(a) * 180)
    ctx.stroke()
  }
  ctx.restore()
}

function vignette(ctx: CanvasRenderingContext2D) {
  const g = ctx.createRadialGradient(VW / 2, VH / 2, 280, VW / 2, VH / 2, 760)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, VW, VH)
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 - Math.PI / 2
    const rad = i % 2 === 0 ? r : r * 0.42
    const px = x + Math.cos(ang) * rad
    const py = y + Math.sin(ang) * rad
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.lineTo(x + r * 0.7, y)
  ctx.lineTo(x, y + r)
  ctx.lineTo(x - r * 0.7, y)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), r)
}

function ease(t: number) {
  const x = clamp(t, 0, 1)
  return 1 - (1 - x) * (1 - x)
}

function shade(hex: string, amt: number) {
  const n = Number.parseInt(hex.slice(1), 16)
  if (!Number.isFinite(n) || hex.length < 7) return hex
  const pick = (shift: number) => {
    const c = (n >> shift) & 255
    const target = amt < 0 ? 0 : 255
    return Math.round(c + (target - c) * Math.min(1, Math.abs(amt)))
  }
  const h = (v: number) => v.toString(16).padStart(2, '0')
  return `#${h(pick(16))}${h(pick(8))}${h(pick(0))}`
}

function hexA(hex: string, alpha: number) {
  const n = Number.parseInt(hex.slice(1), 16)
  if (!Number.isFinite(n)) return `rgba(255,255,255,${alpha})`
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
