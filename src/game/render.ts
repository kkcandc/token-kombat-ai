import { GROUND, VH, VW, clamp } from './constants'
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
}

export function renderMatch(ctx: CanvasRenderingContext2D, m: Match, reduceMotion = false) {
  ctx.clearRect(0, 0, VW, VH)
  drawBackdrop(ctx, m)
  ctx.save()
  const mag = reduceMotion ? 0 : m.shake
  ctx.translate(Math.sin(m.frame * 1.7) * mag, Math.cos(m.frame * 2.2) * mag * 0.6)
  const cam = cameraFor(m)
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
      alpha: 0.45,
    })
  }
  const ordered = [...m.fighters].sort((a, b) => a.y - b.y)
  for (const f of ordered) {
    drawWorld(ctx, cam, f.x, f.y, f.facing, actorFrom(f))
  }
  for (const p of m.projectiles) if (p.delay <= 0) drawProjectile(ctx, p, cam, m.frame)
  for (const s of m.sparks) drawSpark(ctx, s, cam)
  if (m.bubble) drawBubble(ctx, m.bubble.x, m.bubble.y, m.bubble.text, m.bubble.life, cam)
  ctx.restore()
  drawHud(ctx, m)
  if (m.koFlash > 0) {
    ctx.fillStyle = `rgba(255,244,220,${m.koFlash / 48})`
    ctx.fillRect(0, 0, VW, VH)
  }
}

export function renderPortrait(ctx: CanvasRenderingContext2D, def: FighterDef, anim: number) {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  ctx.clearRect(0, 0, w, h)
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#1a120f')
  g.addColorStop(1, '#0c0908')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = def.accent
  ctx.globalAlpha = 0.18
  ctx.beginPath()
  ctx.arc(w * 0.72, h * 0.3, 40, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.save()
  ctx.translate(w / 2, h - 14)
  ctx.scale(0.92 * def.scale, 0.92 * def.scale)
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
  })
  ctx.restore()
}

function actorFrom(f: Fighter): Actor {
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
  }
}

function cameraFor(m: Match): Cam {
  const mid = (m.fighters[0].x + m.fighters[1].x) / 2
  const dist = Math.abs(m.fighters[0].x - m.fighters[1].x)
  const zoom = clamp(1280 / (dist + 230), 0.86, 1.95)
  return { mid, zoom }
}

function project(x: number, y: number, cam: Cam) {
  return {
    x: (x - cam.mid) * cam.zoom + VW / 2,
    y: (y - GROUND) * cam.zoom + 590,
  }
}

function drawBackdrop(ctx: CanvasRenderingContext2D, m: Match) {
  const sky = ctx.createLinearGradient(0, 0, 0, VH)
  sky.addColorStop(0, '#140a12')
  sky.addColorStop(0.42, '#24140f')
  sky.addColorStop(1, '#0a0708')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, VW, VH)

  ctx.save()
  ctx.globalAlpha = 0.55
  ctx.fillStyle = '#e7ff52'
  ctx.beginPath()
  ctx.arc(1040, 120, 46, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 0.25
  ctx.strokeStyle = '#ff4b2b'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(1040, 120, 62, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = 'rgba(231,255,82,0.16)'
  ctx.font = '700 78px "Bebas Neue", Impact, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('T', 1040, 148)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#1a100e'
  for (let i = 0; i < 18; i++) {
    const h = 40 + ((i * 37) % 90)
    const x = 30 + i * 72
    ctx.fillRect(x, 300 - h, 46, h)
    ctx.fillStyle = i % 2 ? '#ff4b2b' : '#e7ff52'
    ctx.globalAlpha = 0.35
    for (let wy = 300 - h + 8; wy < 292; wy += 12) ctx.fillRect(x + 8, wy, 4, 3)
    ctx.globalAlpha = 1
    ctx.fillStyle = '#1a100e'
  }

  ctx.fillStyle = '#120c0b'
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 26; i++) {
      const bob = Math.sin(m.frame / 12 + i + row) * 2
      const x = 16 + i * 50 + (row % 2) * 16
      const y = 318 + row * 22 + bob
      ctx.fillStyle = i % 7 === 0 ? '#ff4b2b' : i % 6 === 0 ? '#e7ff52' : '#2a211c'
      ctx.fillRect(x, y, 14, 18)
      ctx.beginPath()
      ctx.arc(x + 7, y - 5, 6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.fillStyle = 'rgba(246,243,234,0.78)'
  ctx.font = '700 42px "Bebas Neue", Impact, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('TOKEN COLISEUM', VW / 2, 248)
}

function drawFloor(ctx: CanvasRenderingContext2D, m: Match, cam: Cam) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 430, VW, VH - 430)
  ctx.clip()
  const floor = ctx.createLinearGradient(0, 460, 0, VH)
  floor.addColorStop(0, '#1a0d0c')
  floor.addColorStop(1, '#070504')
  ctx.fillStyle = floor
  ctx.fillRect(0, 430, VW, VH - 430)

  ctx.strokeStyle = 'rgba(231,255,82,0.18)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let wx = 0; wx <= 2000; wx += 70) {
    const a = project(wx, GROUND, cam)
    const b = project(wx, GROUND + 260, cam)
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
  }
  for (let i = 0; i <= 8; i++) {
    const a = project(0, GROUND + i * 32, cam)
    const b = project(2000, GROUND + i * 32, cam)
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
  }
  ctx.stroke()

  ctx.strokeStyle = 'rgba(255,75,43,0.85)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.ellipse(VW / 2, 600, 420, 36, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(231,255,82,0.4)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(VW / 2, 600, 490, 52, 0, 0, Math.PI * 2)
  ctx.stroke()

  ctx.globalAlpha = 0.25 + Math.sin(m.frame / 20) * 0.05
  ctx.fillStyle = '#ff4b2b'
  ctx.font = '700 18px "Bebas Neue", Impact, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('TOKEN COLISEUM', VW / 2, 640)
  ctx.restore()
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, cam: Cam) {
  const p = project(x, GROUND, cam)
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.beginPath()
  ctx.ellipse(p.x, p.y + 2, 26 * cam.zoom, 8 * cam.zoom, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawWorld(ctx: CanvasRenderingContext2D, cam: Cam, x: number, y: number, facing: 1 | -1, actor: Actor) {
  const p = project(x, y, cam)
  const z = cam.zoom * actor.def.scale
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.scale(facing * z, z)
  if (actor.state === 'ko') ctx.rotate(-1.05)
  else if (actor.state === 'hit' || actor.state === 'launch') ctx.rotate(-0.14)
  ctx.globalAlpha = actor.alpha
  drawLocal(ctx, actor)
  ctx.restore()
}

function drawLocal(ctx: CanvasRenderingContext2D, a: Actor) {
  const bob = a.state === 'idle' ? Math.sin(a.anim / 10) * 2 : 0
  const crouch = a.crouching ? 24 : 0
  ctx.save()
  ctx.translate(0, bob + crouch)
  if (a.state === 'special') {
    ctx.shadowColor = a.def.accent
    ctx.shadowBlur = 16
  }

  const step = a.state === 'walk' ? Math.sin(a.anim / 3.1) * 10 : 0
  const kick = a.state === 'kick' ? clamp(a.stateFrame / 8, 0, 1) : 0
  const pants = '#23262e'
  limb(ctx, -8, -46, -12 - step * 0.3, -22, -10 + step, 0, 8, pants)
  limb(ctx, 8, -46, 12 + step * 0.2, -22, 10 - step + kick * 36, -8 - kick * 10, 8, pants)
  ctx.fillStyle = '#111'
  ctx.beginPath()
  ctx.ellipse(-10 + step, 2, 8, 4, 0, 0, Math.PI * 2)
  ctx.ellipse(12 - step + kick * 36, 2 - kick * 8, 8, 4, 0, 0, Math.PI * 2)
  ctx.fill()

  const torso = torsoBox(a.def.outfit)
  ctx.fillStyle = '#140c08'
  round(ctx, -torso.w / 2 - 2, torso.top - 1, torso.w + 4, torso.bot - torso.top + 4, 10)
  ctx.fill()
  ctx.fillStyle = a.def.color
  round(ctx, -torso.w / 2, torso.top, torso.w, torso.bot - torso.top, 9)
  ctx.fill()
  ctx.fillStyle = a.def.accent
  ctx.globalAlpha = 0.9
  ctx.fillRect(-torso.w / 2, torso.top + 8, 5, torso.bot - torso.top - 16)
  ctx.globalAlpha = 1
  if (a.def.outfit === 'suit') {
    ctx.fillStyle = '#f4f0e6'
    ctx.beginPath()
    ctx.moveTo(0, torso.top + 4)
    ctx.lineTo(8, torso.bot - 6)
    ctx.lineTo(-8, torso.bot - 6)
    ctx.fill()
  }
  if (a.def.outfit === 'zip') {
    ctx.strokeStyle = '#8d8880'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, torso.top + 6)
    ctx.lineTo(0, torso.bot - 4)
    ctx.stroke()
  }

  const sleeve = a.def.outfit === 'tee' ? a.def.skin : a.def.color
  const punch = a.state === 'punch' || a.state === 'special' ? clamp(a.stateFrame / 6, 0, 1) : 0
  const guard = a.state === 'block'
  const cheer = a.state === 'win'
  const backHand = guard ? { x: -10, y: -96 } : cheer ? { x: -16, y: -112 } : { x: -24, y: -52 + Math.sin(a.anim / 4) * (a.state === 'walk' ? 6 : 0) }
  const frontHand = guard
    ? { x: 18, y: -98 }
    : cheer
      ? { x: 18, y: -116 }
      : { x: 22 + punch * 30, y: -58 - punch * 18 }
  limb(ctx, -14, -70, (backHand.x - 14) * 0.5, (backHand.y - 70) * 0.45 - 70, backHand.x, backHand.y, 7, sleeve)
  limb(ctx, 14, -70, 14 + punch * 10, -78, frontHand.x, frontHand.y, 7, sleeve)

  ctx.fillStyle = '#140c08'
  ctx.beginPath()
  ctx.arc(0, -96, 18, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = a.def.skin
  ctx.beginPath()
  ctx.arc(0, -96, 15.5, 0, Math.PI * 2)
  ctx.fill()
  drawHair(ctx, a.def)

  if (a.state === 'ko') {
    ctx.strokeStyle = '#1a120e'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(-8, -100)
    ctx.lineTo(-3, -95)
    ctx.moveTo(-3, -100)
    ctx.lineTo(-8, -95)
    ctx.moveTo(4, -100)
    ctx.lineTo(9, -95)
    ctx.moveTo(9, -100)
    ctx.lineTo(4, -95)
    ctx.stroke()
  } else {
    ctx.fillStyle = '#1a120e'
    ctx.beginPath()
    ctx.arc(-5.5, -98, 1.7, 0, Math.PI * 2)
    ctx.arc(5.5, -98, 1.7, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#1a120e'
    ctx.lineWidth = 1.3
    ctx.beginPath()
    ctx.arc(0, -92, 4.5, 0.2, Math.PI - 0.2)
    ctx.stroke()
  }
  if (a.def.glasses) {
    ctx.strokeStyle = '#16120f'
    ctx.lineWidth = 1.5
    ctx.strokeRect(-13, -103, 10, 8)
    ctx.strokeRect(3, -103, 10, 8)
    ctx.beginPath()
    ctx.moveTo(-3, -99)
    ctx.lineTo(3, -99)
    ctx.stroke()
  }

  drawProp(ctx, a)
  if (a.shield > 0) {
    ctx.strokeStyle = a.def.accent
    ctx.globalAlpha = 0.8
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(8, -70, 38, 52, 0.2, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  if (a.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.45, a.flash / 10)})`
    ctx.beginPath()
    ctx.arc(0, -70, 46, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function torsoBox(outfit: FighterDef['outfit']) {
  switch (outfit) {
    case 'leather':
      return { w: 36, top: -84, bot: -36 }
    case 'coat':
      return { w: 34, top: -84, bot: -24 }
    case 'blazer':
      return { w: 30, top: -82, bot: -34 }
    case 'tee':
      return { w: 28, top: -78, bot: -40 }
    case 'pullover':
      return { w: 34, top: -82, bot: -34 }
    case 'turtleneck':
      return { w: 28, top: -86, bot: -36 }
    default:
      return { w: 30, top: -82, bot: -36 }
  }
}

function drawHair(ctx: CanvasRenderingContext2D, def: FighterDef) {
  ctx.fillStyle = def.hairColor
  if (def.hair === 'buzz') {
    ctx.beginPath()
    ctx.ellipse(0, -108, 14, 7, 0, Math.PI, 0)
    ctx.fill()
    return
  }
  if (def.hair === 'bob') {
    ctx.beginPath()
    ctx.arc(0, -100, 17, Math.PI, 0)
    ctx.quadraticCurveTo(18, -90, 15, -78)
    ctx.lineTo(-15, -78)
    ctx.quadraticCurveTo(-18, -90, -17, -100)
    ctx.fill()
    return
  }
  if (def.hair === 'curly') {
    for (const [x, y, r] of [
      [0, -112, 7],
      [-10, -106, 6],
      [10, -106, 6],
      [-6, -100, 5],
      [7, -100, 5],
    ] as const) {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }
  if (def.hair === 'wavy' || def.hair === 'side') {
    ctx.beginPath()
    ctx.moveTo(-16, -96)
    ctx.quadraticCurveTo(-18, -118, 0, -116)
    ctx.quadraticCurveTo(20, -114, 16, -96)
    ctx.quadraticCurveTo(8, -108, -16, -96)
    ctx.fill()
    if (def.hair === 'wavy') {
      ctx.beginPath()
      ctx.ellipse(10, -78, 8, 14, 0.4, 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }
  ctx.beginPath()
  ctx.ellipse(0, -110, 14, 8, 0, Math.PI, 0)
  ctx.fill()
}

function drawProp(ctx: CanvasRenderingContext2D, a: Actor) {
  const c = a.def.accent
  ctx.save()
  if (a.def.prop === 'halo') {
    ctx.strokeStyle = c
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(0, -122, 16, 6, 0, 0, Math.PI * 2)
    ctx.stroke()
  } else if (a.def.prop === 'rocket') {
    ctx.translate(-20, -78)
    ctx.rotate(-0.7)
    ctx.fillStyle = c
    ctx.fillRect(-4, 0, 8, 20)
    ctx.beginPath()
    ctx.moveTo(-4, 0)
    ctx.lineTo(0, -8)
    ctx.lineTo(4, 0)
    ctx.fill()
    ctx.fillStyle = '#f4f0e6'
    ctx.fillRect(-2, 6, 4, 6)
  } else if (a.def.prop === 'chip') {
    ctx.strokeStyle = c
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(-8, -62)
    ctx.lineTo(8, -68)
    ctx.lineTo(6, -52)
    ctx.moveTo(-6, -50)
    ctx.lineTo(10, -58)
    ctx.stroke()
  } else if (a.def.prop === 'stone') {
    const ang = a.anim / 12
    ctx.fillStyle = '#f7f4ee'
    ctx.beginPath()
    ctx.arc(Math.cos(ang) * 22, -78 + Math.sin(ang) * 8, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1a1a1a'
    ctx.beginPath()
    ctx.arc(Math.cos(ang + 2) * 20, -60 + Math.sin(ang + 1) * 6, 4, 0, Math.PI * 2)
    ctx.fill()
  } else if (a.def.prop === 'shield') {
    ctx.strokeStyle = c
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(24, -78)
    ctx.lineTo(34, -70)
    ctx.lineTo(30, -54)
    ctx.lineTo(24, -48)
    ctx.lineTo(18, -54)
    ctx.lineTo(14, -70)
    ctx.closePath()
    ctx.stroke()
  } else if (a.def.prop === 'prism') {
    ctx.fillStyle = c
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.moveTo(26, -86)
    ctx.lineTo(38, -70)
    ctx.lineTo(22, -66)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  } else if (a.def.prop === 'spark') {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.arc(0, -124, 4 + Math.sin(a.anim / 4), 0, Math.PI * 2)
    ctx.fill()
  } else if (a.def.prop === 'llama') {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.ellipse(22, -86, 8, 5.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(17, -93, 2.2, 4, -0.3, 0, Math.PI * 2)
    ctx.ellipse(25, -93, 2.2, 4, 0.3, 0, Math.PI * 2)
    ctx.fill()
  } else if (a.def.prop === 'drone') {
    const y = -108 + Math.sin(a.anim / 8) * 3
    ctx.fillStyle = c
    round(ctx, -28, y, 14, 6, 2)
    ctx.fill()
    round(ctx, 16, y + 6, 14, 6, 2)
    ctx.fill()
  } else if (a.def.prop === 'crystal') {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.moveTo(24, -90)
    ctx.lineTo(32, -76)
    ctx.lineTo(24, -64)
    ctx.lineTo(16, -76)
    ctx.closePath()
    ctx.fill()
  } else if (a.def.prop === 'cake') {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.moveTo(18, -60)
    ctx.lineTo(34, -60)
    ctx.lineTo(30, -74)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillRect(20, -66, 12, 3)
  } else if (a.def.prop === 'code') {
    ctx.fillStyle = c
    ctx.font = '700 12px "Sora", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('</>', 26, -72)
  }
  ctx.restore()
}

function limb(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  w: number,
  color: string,
) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#140c08'
  ctx.lineWidth = w + 4
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.lineTo(x3, y3)
  ctx.stroke()
  ctx.strokeStyle = color
  ctx.lineWidth = w
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.lineTo(x3, y3)
  ctx.stroke()
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function drawGhost(ctx: CanvasRenderingContext2D, g: { x: number; y: number; life: number; color: string }, cam: Cam) {
  const p = project(g.x, g.y, cam)
  ctx.save()
  ctx.globalAlpha = g.life / 10
  ctx.fillStyle = g.color
  ctx.beginPath()
  ctx.ellipse(p.x, p.y - 50 * cam.zoom, 16 * cam.zoom, 36 * cam.zoom, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawZone(
  ctx: CanvasRenderingContext2D,
  z: { kind: string; x: number; r: number; life: number; acc: number },
  cam: Cam,
  frame: number,
) {
  const p = project(z.x, GROUND, cam)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.scale(cam.zoom, cam.zoom * 0.45)
  if (z.kind === 'slow') {
    ctx.strokeStyle = 'rgba(244,241,234,0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, z.r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 0.35
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath()
      ctx.moveTo(-z.r, i * 28)
      ctx.lineTo(z.r, i * 28)
      ctx.moveTo(i * 28, -z.r)
      ctx.lineTo(i * 28, z.r)
      ctx.stroke()
    }
  } else if (z.kind === 'snare') {
    ctx.strokeStyle = '#ffd0e0'
    ctx.lineWidth = 3
    ctx.globalAlpha = 0.5 + Math.sin(frame / 6) * 0.2
    ctx.beginPath()
    ctx.arc(0, 0, z.r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, -18)
    ctx.lineTo(12, 0)
    ctx.lineTo(0, 18)
    ctx.lineTo(-12, 0)
    ctx.closePath()
    ctx.stroke()
  } else {
    ctx.fillStyle = '#ffb7d5'
    ctx.globalAlpha = 0.45
    for (let i = 0; i < 5; i++) {
      ctx.beginPath()
      ctx.ellipse(Math.cos(i) * 30, Math.sin(i * 2) * 16, 16, 8, i, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, cam: Cam, frame: number) {
  const pos = project(p.x, p.y, cam)
  ctx.save()
  ctx.translate(pos.x, pos.y)
  if (p.kind === 'beam') {
    ctx.scale(p.facing, 1)
    const g = ctx.createLinearGradient(0, 0, p.w * cam.zoom, 0)
    g.addColorStop(0, 'rgba(125,255,106,0.15)')
    g.addColorStop(0.2, '#f4fff0')
    g.addColorStop(1, 'rgba(125,255,106,0.05)')
    ctx.fillStyle = g
    ctx.fillRect(0, -p.h * cam.zoom * 0.5, p.w * cam.zoom, p.h * cam.zoom)
    ctx.restore()
    return
  }
  const s = cam.zoom
  if (p.kind === 'orb') {
    ctx.fillStyle = '#7ee0ff'
    ctx.shadowColor = '#7ee0ff'
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.arc(0, 0, 10 * s, 0, Math.PI * 2)
    ctx.fill()
  } else if (p.kind === 'rocket') {
    const ang = Math.atan2(p.vy, p.vx)
    ctx.rotate(ang)
    ctx.fillStyle = '#ff8a3d'
    ctx.fillRect(-16 * s, -5 * s, 28 * s, 10 * s)
    ctx.beginPath()
    ctx.moveTo(12 * s, -5 * s)
    ctx.lineTo(22 * s, 0)
    ctx.lineTo(12 * s, 5 * s)
    ctx.fill()
    ctx.fillStyle = '#e7ff52'
    ctx.globalAlpha = 0.8
    ctx.fillRect(-22 * s, -3 * s, 8 * s, 6 * s)
  } else if (p.kind === 'stone') {
    ctx.fillStyle = frame % 16 < 8 ? '#f7f4ee' : '#1a1a1a'
    ctx.beginPath()
    ctx.arc(0, 0, 9 * s, 0, Math.PI * 2)
    ctx.fill()
  } else if (p.kind === 'llama') {
    ctx.fillStyle = '#4ea1ff'
    ctx.beginPath()
    ctx.ellipse(0, 0, 14 * s, 9 * s, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(-6 * s, -8 * s, 3 * s, 5 * s, 0, 0, Math.PI * 2)
    ctx.ellipse(4 * s, -8 * s, 3 * s, 5 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (p.kind === 'shot' || p.kind === 'drone') {
    ctx.fillStyle = p.kind === 'drone' ? '#d7ecff' : '#79e0ff'
    round(ctx, -8 * s, -4 * s, 16 * s, 8 * s, 3)
    ctx.fill()
  } else if (p.kind === 'cloud') {
    ctx.fillStyle = 'rgba(215,236,255,0.85)'
    ctx.beginPath()
    ctx.ellipse(0, 0, 54 * s, 24 * s, 0, 0, Math.PI * 2)
    ctx.ellipse(-30 * s, 6 * s, 28 * s, 16 * s, 0, 0, Math.PI * 2)
    ctx.ellipse(28 * s, 8 * s, 24 * s, 14 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (p.kind === 'crystal') {
    ctx.fillStyle = '#ffd0e0'
    ctx.beginPath()
    ctx.moveTo(0, -14 * s)
    ctx.lineTo(10 * s, 0)
    ctx.lineTo(0, 14 * s)
    ctx.lineTo(-10 * s, 0)
    ctx.closePath()
    ctx.fill()
  } else if (p.kind === 'cake') {
    ctx.fillStyle = '#ffb7d5'
    ctx.fillRect(-14 * s, -8 * s, 28 * s, 16 * s)
    ctx.fillStyle = '#fff6fb'
    ctx.fillRect(-14 * s, -2 * s, 28 * s, 4 * s)
  } else if (p.kind === 'glyph') {
    ctx.fillStyle = '#b6ff4a'
    ctx.font = `700 ${14 * s}px "Sora", sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(['{ }', '∇', 'λ', '01', '</>'][p.phase % 5], 0, 4 * s)
  }
  ctx.restore()
}

function drawSpark(ctx: CanvasRenderingContext2D, s: Spark, cam: Cam) {
  const p = project(s.x, s.y, cam)
  const t = s.life / s.max
  ctx.save()
  ctx.globalAlpha = Math.max(0, t)
  ctx.fillStyle = s.color
  ctx.strokeStyle = s.color
  if (s.kind === 'text' && s.text) {
    ctx.font = '700 18px "Bebas Neue", Impact, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(s.text, p.x, p.y)
  } else if (s.kind === 'ring') {
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(p.x, p.y, (1 - t) * 36 + 6, 0, Math.PI * 2)
    ctx.stroke()
  } else {
    ctx.fillRect(p.x, p.y, s.size, s.size)
  }
  ctx.restore()
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, life: number, cam: Cam) {
  const p = project(x, y, cam)
  ctx.save()
  ctx.globalAlpha = Math.min(1, life / 12)
  ctx.fillStyle = '#f6f3ea'
  round(ctx, p.x - 90, p.y - 18, 180, 32, 8)
  ctx.fill()
  ctx.fillStyle = '#1a100e'
  ctx.font = '700 14px "Sora", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(text, p.x, p.y + 4)
  ctx.restore()
}

function drawHud(ctx: CanvasRenderingContext2D, m: Match) {
  const left = m.fighters[0]
  const right = m.fighters[1]
  bar(ctx, 36, 36, 430, left)
  bar(ctx, VW - 36 - 430, 36, 430, right, true)
  ctx.fillStyle = '#f6f3ea'
  ctx.font = '700 42px "Bebas Neue", Impact, sans-serif'
  ctx.textAlign = 'center'
  const secs = Math.max(0, Math.ceil(m.timer / 60))
  ctx.fillText(m.phase === 'fight' ? String(secs) : '•', VW / 2, 68)

  const showBanner = m.phase !== 'fight' || m.calloutT > 40
  if (m.phase === 'intro' || m.phase === 'roundend' || m.phase === 'matchend' || (m.callout && m.calloutT > 0 && m.phase === 'fight')) {
    const big = m.phase !== 'fight'
    ctx.fillStyle = 'rgba(8,5,4,0.72)'
    const bw = big ? 760 : 520
    const bh = big ? 118 : 54
    const by = big ? 150 : 108
    round(ctx, VW / 2 - bw / 2, by, bw, bh, 8)
    ctx.fill()
    ctx.fillStyle = '#e7ff52'
    ctx.font = big ? '700 54px "Bebas Neue", Impact, sans-serif' : '700 28px "Bebas Neue", Impact, sans-serif'
    const line = big ? m.banner : m.callout
    ctx.fillText(line, VW / 2, by + (big ? 52 : 36))
    if (big) {
      ctx.fillStyle = '#f6f3ea'
      ctx.font = '600 16px "Sora", sans-serif'
      ctx.fillText(m.sub, VW / 2, by + 88)
    }
  }
  if (showBanner && m.phase === 'intro') {
    ctx.font = '700 28px "Bebas Neue", Impact, sans-serif'
    ctx.fillStyle = left.def.accent
    ctx.textAlign = 'left'
    ctx.fillText(left.def.last, 48, 200)
    ctx.fillStyle = right.def.accent
    ctx.textAlign = 'right'
    ctx.fillText(right.def.last, VW - 48, 200)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#f6f3ea'
    ctx.fillText('VS', VW / 2, 200)
  }

  if (m.phase === 'fight' && m.frame < 240) {
    ctx.textAlign = 'center'
    ctx.font = '600 13px "Sora", sans-serif'
    ctx.fillStyle = 'rgba(246,243,234,0.75)'
    const hint =
      m.mode === 'local'
        ? 'P1  J K L I     ·     P2  N M , .'
        : 'WASD or arrows  ·  J punch  ·  K kick  ·  L special  ·  I block'
    ctx.fillText(hint, VW / 2, 132)
  }
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, f: Fighter, mirror = false) {
  ctx.textAlign = mirror ? 'right' : 'left'
  ctx.fillStyle = '#f6f3ea'
  ctx.font = '700 22px "Bebas Neue", Impact, sans-serif'
  ctx.fillText(f.def.last, mirror ? x + w : x, y - 6)
  ctx.fillStyle = '#2a211c'
  round(ctx, x, y, w, 16, 3)
  ctx.fill()
  const pct = clamp(f.hp / 100, 0, 1)
  ctx.fillStyle = f.hp < 30 ? '#ff4b2b' : f.def.accent
  const fw = Math.max(0, (w - 4) * pct)
  if (mirror) round(ctx, x + w - 2 - fw, y + 2, fw, 12, 2)
  else round(ctx, x + 2, y + 2, fw, 12, 2)
  ctx.fill()

  ctx.fillStyle = '#2a211c'
  round(ctx, x, y + 22, 180, 8, 2)
  ctx.fill()
  const mp = clamp(f.meter / 100, 0, 1)
  ctx.fillStyle = mp >= 1 ? '#e7ff52' : '#f6f3ea'
  const mw = 176 * mp
  if (mirror) round(ctx, x + 180 - 2 - mw, y + 24, mw, 4, 1)
  else round(ctx, x + 2, y + 24, mw, 4, 1)
  ctx.fill()

  for (let i = 0; i < 2; i++) {
    const px = mirror ? x + w - 18 - i * 16 : x + i * 16
    ctx.strokeStyle = f.def.accent
    ctx.lineWidth = 2
    ctx.strokeRect(px, y + 36, 10, 10)
    if (i < f.wins) {
      ctx.fillStyle = '#e7ff52'
      ctx.fillRect(px, y + 36, 10, 10)
    }
  }
  if (f.chain >= 2 && f.chainTimer > 0) {
    ctx.font = '700 14px "Bebas Neue", Impact, sans-serif'
    ctx.fillStyle = '#e7ff52'
    ctx.fillText(`${f.chain}-HIT CHAIN`, mirror ? x + w : x, y + 62)
  }
}
