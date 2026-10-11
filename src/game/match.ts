import { GRAV, GROUND, JUMP_V, STAGE_LEFT, STAGE_RIGHT, clamp } from './constants'
import { getFighter } from './roster'
import {
  emptyPad,
  type Fighter,
  type HitTier,
  type Match,
  type Mode,
  type Pad,
  type Pending,
  type Projectile,
  type Zone,
} from './types'

const BOOTH = [
  'The Swisher Booth: "Try not to overfit live."',
  'The Swisher Booth: "That punch had a launch window."',
  'The Swisher Booth: "I have follow-ups. You have hitstun."',
  'The Swisher Booth: "Ship it, then we talk bruises."',
  'The Swisher Booth: "Cute special. Show me the moat."',
  'The Swisher Booth: "We can do this all keynote."',
]

const ROASTS = ['REENTRY WINDOW', 'MEME TRAJECTORY', 'STAGE SEPARATION', 'UNSCHEDULED LAUNCH', 'TRY A SOFTER LAUNCH']
const LABELS = ['PERSON', 'TOKEN', 'SMILE', 'ARENA', 'MODEL', 'HAND']

interface Strike {
  startup: number
  active: number
  recovery: number
  damage: number
  hitstun: number
  knockback: number
  lift: number
  reach: number
  y: number
  h: number
  chip: number
}

const STRIKES: Record<string, Strike> = {
  punch: { startup: 5, active: 3, recovery: 12, damage: 7, hitstun: 16, knockback: 4.6, lift: 0, reach: 58, y: 90, h: 22, chip: 0.16 },
  kick: { startup: 8, active: 3, recovery: 14, damage: 11, hitstun: 20, knockback: 7.2, lift: -1.2, reach: 76, y: 70, h: 24, chip: 0.16 },
  cpunch: { startup: 5, active: 3, recovery: 11, damage: 6, hitstun: 15, knockback: 3.6, lift: 0, reach: 56, y: 40, h: 20, chip: 0.16 },
  ckick: { startup: 7, active: 4, recovery: 14, damage: 9, hitstun: 18, knockback: 8, lift: 0, reach: 90, y: 28, h: 18, chip: 0.16 },
  apunch: { startup: 4, active: 4, recovery: 9, damage: 7, hitstun: 15, knockback: 4, lift: -3.2, reach: 56, y: 78, h: 22, chip: 0.2 },
  akick: { startup: 6, active: 4, recovery: 11, damage: 10, hitstun: 18, knockback: 6, lift: -6.2, reach: 72, y: 56, h: 24, chip: 0.2 },
}

/** Altman's standing kit. Windows line up with the windup / snap / recover pose. */
const ALTMAN: Record<string, Strike> = {
  punch: { startup: 4, active: 3, recovery: 11, damage: 6, hitstun: 17, knockback: 3.5, lift: 0, reach: 64, y: 92, h: 24, chip: 0.16 },
  kick: { startup: 8, active: 3, recovery: 16, damage: 11, hitstun: 24, knockback: 6.8, lift: -1.6, reach: 84, y: 66, h: 26, chip: 0.18 },
}

const HIT_STOP: Record<HitTier, number> = { light: 2, mid: 4, heavy: 6 }

const SPECIAL_END: Record<string, number> = {
  altman: 36,
  elon: 32,
  jensen: 48,
  demis: 30,
  dario: 42,
  mira: 28,
  ilya: 26,
  zuck: 46,
  satya: 40,
  feifei: 32,
  lecun: 36,
  karpathy: 46,
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

export function createMatch(p1Id: string, p2Id: string, mode: Mode, seed = 1): Match {
  const m: Match = {
    fighters: [makeFighter(p1Id, 0, 640), makeFighter(p2Id, 1, 1360)],
    projectiles: [],
    zones: [],
    clones: [],
    sparks: [],
    ghosts: [],
    pending: [],
    mode,
    phase: 'intro',
    phaseTimer: 100,
    round: 0,
    timer: 99 * 60,
    hitstop: 0,
    shake: 0,
    frame: 0,
    seed: seed >>> 0,
    banner: '',
    sub: '',
    callout: '',
    calloutT: 0,
    bubble: null,
    sfx: [],
    koFlash: 0,
    winner: null,
    fxCount: 0,
    zoomKick: 0,
    panKick: 0,
    kickX: 0,
    kickY: 0,
    impact: 0,
    impactTier: 0,
    impactX: 0,
    impactY: 0,
    lastAdv: 0,
    lastAdvT: 0,
    koHold: null,
  }
  startRound(m)
  return m
}

export function stepMatch(m: Match, pads: [Pad, Pad]) {
  m.sfx = []
  if (m.hitstop > 0 && m.phase === 'fight') {
    m.hitstop--
    decayFx(m, true)
    if (m.hitstop === 0 && m.koHold !== null) endRound(m, m.koHold)
    return
  }

  if (m.phase === 'intro' || m.phase === 'roundend') {
    m.phaseTimer--
    for (const f of m.fighters) coast(f)
    if (m.phaseTimer <= 0) {
      if (m.phase === 'intro') {
        m.phase = 'fight'
        m.sfx.push('round')
      } else if (m.fighters.some((f) => f.wins >= 2)) {
        enterMatchEnd(m)
      } else {
        startRound(m)
      }
    }
    decayFx(m, false)
    return
  }

  if (m.phase === 'matchend') {
    for (const f of m.fighters) coast(f)
    decayFx(m, false)
    return
  }

  m.pending = []
  for (const f of m.fighters) f.damageTaken = 0
  const use: [Pad, Pad] = [padFor(m, 0, pads[0]), padFor(m, 1, pads[1])]
  updateFighter(m, m.fighters[0], use[0])
  updateFighter(m, m.fighters[1], use[1])
  updateClones(m)
  updateProjectiles(m)
  updateZones(m)
  for (const hit of m.pending) resolveHit(m, hit)
  separate(m)
  for (const f of m.fighters) clampFighter(f)
  m.projectiles = m.projectiles.filter((p) => p.life > 0 && p.x > -200 && p.x < 2200)
  m.zones = m.zones.filter((z) => z.life > 0)
  m.clones = m.clones.filter((c) => c.life > 0)
  m.timer--
  checkRound(m)
  decayFx(m, false)
}

export function skipIntro(m: Match) {
  if (m.phase === 'intro') m.phaseTimer = 1
}

function startRound(m: Match) {
  m.round += 1
  m.phase = 'intro'
  m.phaseTimer = 100
  m.timer = 99 * 60
  m.hitstop = 0
  m.koHold = null
  m.zoomKick = 0
  m.panKick = 0
  m.kickX = 0
  m.kickY = 0
  m.impact = 0
  m.projectiles = []
  m.zones = []
  m.clones = []
  m.pending = []
  m.ghosts = []
  m.bubble = null
  const xs: [number, number] = [760, 1160]
  const faces: [1 | -1, 1 | -1] = [1, -1]
  for (let i = 0; i < 2; i++) resetBody(m.fighters[i], xs[i], faces[i], m.round === 1)
  const label = m.round <= 1 ? 'ROUND ONE — COMPILE' : m.round === 2 ? 'ROUND TWO — FINE-TUNE' : 'FINAL ROUND — DEPLOY'
  m.banner = label
  m.sub = BOOTH[(m.round + (m.seed % 5)) % BOOTH.length]
  m.callout = label
  m.calloutT = 70
}

function enterMatchEnd(m: Match) {
  const w = m.winner ?? (m.fighters[0].wins >= 2 ? 0 : 1)
  m.winner = w
  m.phase = 'matchend'
  const champ = m.fighters[w]
  m.banner = champ.def.catchphrase
  m.sub = `${champ.def.name} wins the benchmark.`
  m.callout = 'SYSTEM HALT'
  m.calloutT = 120
  champ.state = 'win'
  m.fighters[1 - w].state = 'ko'
}

function resetBody(f: Fighter, x: number, facing: 1 | -1, first: boolean) {
  const carry = first ? 18 : clamp(f.meter * 0.35, 18, 40)
  f.x = x
  f.y = GROUND
  f.vx = 0
  f.vy = 0
  f.facing = facing
  f.hp = 100
  f.meter = carry
  f.state = 'idle'
  f.stateFrame = 0
  f.grounded = true
  f.crouching = false
  f.airUsed = false
  f.hitstun = 0
  f.blockstun = 0
  f.invuln = 24
  f.armor = 0
  f.shield = 0
  f.root = 0
  f.slow = 0
  f.flash = 0
  f.chain = 0
  f.chainTimer = 0
  f.didHit = false
  f.power = 0
  f.hop = false
  f.grabbing = false
  f.grabTried = false
  f.countered = false
  f.buf = null
  f.strike = null
  f.strikeAir = false
  f.strikeLow = false
  f.damageTaken = 0
  f.recoil = 0
}

function makeFighter(id: string, player: 0 | 1, x: number): Fighter {
  return {
    def: getFighter(id),
    player,
    x,
    y: GROUND,
    vx: 0,
    vy: 0,
    facing: player === 0 ? 1 : -1,
    hp: 100,
    meter: 18,
    wins: 0,
    state: 'idle',
    stateFrame: 0,
    grounded: true,
    crouching: false,
    airUsed: false,
    hitstun: 0,
    blockstun: 0,
    invuln: 24,
    armor: 0,
    shield: 0,
    root: 0,
    slow: 0,
    flash: 0,
    chain: 0,
    chainTimer: 0,
    didHit: false,
    power: 0,
    hop: false,
    grabbing: false,
    grabTried: false,
    countered: false,
    cooldown: 0,
    react: 0,
    blockT: 0,
    buf: null,
    anim: player * 12,
    strike: null,
    strikeAir: false,
    strikeLow: false,
    damageTaken: 0,
    recoil: 0,
  }
}

function rand(m: Match) {
  m.seed = (Math.imul(m.seed, 1664525) + 1013904223) >>> 0
  return m.seed / 4294967296
}

function padFor(m: Match, index: 0 | 1, incoming: Pad): Pad {
  if (m.mode === 'demo') return cpuPad(m, m.fighters[index])
  if (m.mode === 'cpu' && index === 1) return cpuPad(m, m.fighters[index])
  return incoming
}

function cpuPad(m: Match, f: Fighter): Pad {
  const pad = emptyPad()
  const opp = m.fighters[1 - f.player]
  const dx = opp.x - f.x
  const dist = Math.abs(dx)
  const attacking = opp.state === 'punch' || opp.state === 'kick' || opp.state === 'special'
  if (f.cooldown > 0) f.cooldown--
  if (m.timer > 99 * 60 - 45) {
    if (dx < 0) pad.left = true
    else pad.right = true
    return pad
  }
  if (attacking && dist < 170 && f.react === 0) f.react = 10 + Math.floor(rand(m) * 10)
  if (f.react > 0) {
    f.react--
    if (f.react === 0 && rand(m) < 0.42) f.blockT = 8 + Math.floor(rand(m) * 10)
  }
  if (f.blockT > 0) {
    f.blockT--
    pad.block = true
    if (opp.crouching || opp.strikeLow) pad.down = true
    return pad
  }
  const busy = !canAct(f)
  if (!busy && f.cooldown <= 0 && f.meter >= meterNeed(f) && dist < 300 && dist > 48 && rand(m) < 0.008) {
    pad.specialPressed = true
    f.cooldown = 150
    return pad
  }
  if (!busy && dist < 36 && rand(m) < 0.55) {
    if (dx < 0) pad.right = true
    else pad.left = true
    return pad
  }
  if (!busy && dist < 78 && rand(m) < 0.07) {
    if (rand(m) < 0.45) pad.kickPressed = true
    else pad.punchPressed = true
    if (opp.state === 'jump' || opp.state === 'fall') pad.punchPressed = true
    return pad
  }
  if (dist > 150 && rand(m) < 0.012) pad.up = true
  if (dx < 0) pad.left = true
  else pad.right = true
  return pad
}

function canAct(f: Fighter) {
  return (
    f.hitstun <= 0 &&
    f.blockstun <= 0 &&
    (f.state === 'idle' || f.state === 'walk' || f.state === 'crouch' || f.state === 'jump' || f.state === 'fall')
  )
}

function meterNeed(f: Fighter) {
  return f.def.id === 'ilya' ? 40 : f.def.cost
}

function updateFighter(m: Match, f: Fighter, pad: Pad) {
  const opp = m.fighters[1 - f.player]
  f.anim++
  if (pad.special || pad.specialPressed) f.buf = { k: 'special', n: 20 }
  else if (pad.punch || pad.punchPressed) f.buf = { k: 'punch', n: 20 }
  else if (pad.kick || pad.kickPressed) f.buf = { k: 'kick', n: 20 }
  if (f.invuln > 0) f.invuln--
  if (f.shield > 0) f.shield--
  if (f.root > 0) f.root--
  if (f.slow > 0) f.slow--
  if (f.armor > 0) f.armor--
  if (f.flash > 0) f.flash--
  if (f.recoil > 0) f.recoil--
  if (f.chainTimer > 0) {
    f.chainTimer--
    if (f.chainTimer === 0) f.chain = 0
  }
  if (f.cooldown > 0 && m.mode !== 'cpu' && m.mode !== 'demo') f.cooldown--

  if (f.state === 'ko' || f.state === 'win') {
    coast(f)
    return
  }

  if (f.state === 'grabbed') {
    f.hitstun--
    if (f.hitstun <= 0) f.state = 'idle'
    return
  }

  integrate(f)

  const attacking = f.state === 'punch' || f.state === 'kick' || f.state === 'special'
  if (!attacking && f.hitstun <= 0 && f.state !== 'getup' && Math.abs(opp.x - f.x) > 4) {
    f.facing = opp.x >= f.x ? 1 : -1
  }

  if (f.hitstun > 0) {
    f.hitstun--
    f.x += f.vx
    f.vx *= 0.9
    if (!f.grounded) f.state = 'launch'
    else if (f.hitstun <= 0 && f.state !== 'getup') f.state = 'idle'
    return
  }

  if (f.blockstun > 0) {
    f.blockstun--
    f.state = 'block'
    f.x += f.vx
    f.vx *= 0.7
    return
  }

  if (f.state === 'getup') {
    f.stateFrame++
    f.invuln = Math.max(f.invuln, 1)
    if (f.stateFrame > 12) f.state = 'idle'
    return
  }

  if (attacking) {
    f.stateFrame++
    if (f.state === 'special') tickSpecial(m, f, opp)
    else tickStrike(m, f)
    if (f.state === 'punch' || f.state === 'kick' || f.state === 'special') {
      const slide =
        f.state === 'special' && (f.def.id === 'ilya' || f.def.id === 'mira' || f.def.id === 'altman')
      if (!slide) f.vx *= 0.45
      f.x += f.vx
    }
    return
  }

  if (f.buf?.k === 'special' && f.meter < meterNeed(f) && !pad.special) f.buf = null
  const wantS = f.buf?.k === 'special'
  const wantP = f.buf?.k === 'punch'
  const wantK = f.buf?.k === 'kick'

  if (f.grounded && wantS && f.meter >= meterNeed(f)) {
    f.buf = null
    beginSpecial(m, f)
    return
  }
  if (wantP && (f.grounded || !f.airUsed)) {
    f.buf = null
    startStrike(m, f, 'punch')
    return
  }
  if (wantK && (f.grounded || !f.airUsed)) {
    f.buf = null
    startStrike(m, f, 'kick')
    return
  }
  if (f.buf && !pad.special && !pad.punch && !pad.kick) {
    f.buf.n--
    if (f.buf.n <= 0) f.buf = null
  }

  if (pad.block && f.grounded) {
    f.state = 'block'
    f.crouching = pad.down
    f.vx = 0
    return
  }

  if (!f.grounded) {
    f.state = f.vy < 0 ? 'jump' : 'fall'
    f.crouching = false
    const dir = (pad.right ? 1 : 0) - (pad.left ? 1 : 0)
    f.vx = dir * 3.7 * (f.root > 0 ? 0 : 1)
    f.x += f.vx
    return
  }

  if (pad.up) {
    f.vy = JUMP_V
    f.grounded = false
    f.y -= 1
    f.state = 'jump'
    f.crouching = false
    return
  }

  f.crouching = pad.down
  if (pad.down) {
    f.state = 'crouch'
    f.vx = 0
    return
  }

  const dir = (pad.right ? 1 : 0) - (pad.left ? 1 : 0)
  const spd = 5.35 * (f.slow > 0 ? 0.42 : 1) * (f.root > 0 ? 0 : 1)
  f.vx = dir * spd
  f.x += f.vx
  f.state = dir !== 0 ? 'walk' : 'idle'
}

function integrate(f: Fighter) {
  if (!f.grounded) {
    f.vy = Math.min(16, f.vy + GRAV)
    f.y += f.vy
    if (f.y >= GROUND) {
      f.y = GROUND
      f.vy = 0
      f.grounded = true
      f.airUsed = false
      if (f.state === 'jump' || f.state === 'fall' || f.state === 'launch') {
        if (f.hitstun > 0) {
          f.state = 'getup'
          f.stateFrame = 0
        } else {
          f.state = 'idle'
        }
      }
    }
  }
}

function coast(f: Fighter) {
  f.anim++
  if (!f.grounded) {
    f.vy = Math.min(16, f.vy + GRAV)
    f.y += f.vy
    if (f.y >= GROUND) {
      f.y = GROUND
      f.vy = 0
      f.grounded = true
    }
  }
  f.x += f.vx
  f.vx *= 0.9
  clampFighter(f)
}

function startStrike(m: Match, f: Fighter, kind: 'punch' | 'kick') {
  if (!f.grounded) f.airUsed = true
  f.state = kind
  f.stateFrame = 0
  f.didHit = false
  f.strike = kind
  f.strikeAir = !f.grounded
  f.strikeLow = f.grounded && f.crouching
  f.vx = 0
  m.sfx.push(kind)
}

function strikeSpec(f: Fighter): Strike {
  const key = f.strikeAir
    ? f.strike === 'kick'
      ? 'akick'
      : 'apunch'
    : f.strikeLow
      ? f.strike === 'kick'
        ? 'ckick'
        : 'cpunch'
      : f.strike === 'kick'
        ? 'kick'
        : 'punch'
  if (f.def.id === 'altman' && ALTMAN[key]) return ALTMAN[key]
  return STRIKES[key]
}

function tickStrike(m: Match, f: Fighter) {
  if (tryAltmanCancel(m, f)) return
  const s = strikeSpec(f)
  const total = s.startup + s.active + s.recovery
  if (f.stateFrame > s.startup && f.stateFrame <= s.startup + s.active) queueMelee(m, f, s, 'strike')
  if (f.stateFrame >= total) {
    f.state = f.grounded ? 'idle' : 'fall'
    f.strike = null
  }
}

/** Hit-confirm only. Punch links into kick or special; kick links into special. Whiff keeps the recovery. */
function tryAltmanCancel(m: Match, f: Fighter): boolean {
  if (f.def.id !== 'altman' || !f.didHit || !f.grounded || f.strikeAir || f.strikeLow) return false
  if (f.strike !== 'punch' && f.strike !== 'kick') return false
  const s = strikeSpec(f)
  const activeEnd = s.startup + s.active
  const cancelEnd = activeEnd + Math.max(3, Math.round(s.recovery * 0.34))
  if (f.stateFrame < s.startup + 1 || f.stateFrame > cancelEnd) return false
  const next = f.buf?.k
  if (f.strike === 'punch' && next === 'kick') {
    f.buf = null
    startStrike(m, f, 'kick')
    m.callout = 'LINKED'
    m.calloutT = 22
    return true
  }
  if ((f.strike === 'punch' || f.strike === 'kick') && next === 'special' && f.meter >= meterNeed(f)) {
    f.buf = null
    beginSpecial(m, f)
    return true
  }
  return false
}

export interface AttackRead {
  name: string
  startup: number
  active: number
  recovery: number
  now: number
  phase: 'STARTUP' | 'ACTIVE' | 'RECOVERY'
  cancel: boolean
}

const SPECIAL_HIT: Record<string, { startup: number; active: number; name: string }> = {
  altman: { startup: 9, active: 6, name: 'SOFTMAX' },
  elon: { startup: 10, active: 8, name: 'ROCKET' },
  jensen: { startup: 14, active: 16, name: 'BEAM' },
  demis: { startup: 8, active: 6, name: 'REWIND' },
  dario: { startup: 3, active: 24, name: 'CLAUSE' },
  mira: { startup: 6, active: 18, name: 'MIRAGE' },
  ilya: { startup: 4, active: 13, name: 'CHARGE' },
  zuck: { startup: 8, active: 28, name: 'FEED' },
  satya: { startup: 8, active: 20, name: 'COPILOT' },
  feifei: { startup: 8, active: 8, name: 'SNARE' },
  lecun: { startup: 10, active: 8, name: 'CAKE' },
  karpathy: { startup: 16, active: 18, name: 'SPIRAL' },
}

export function attackRead(f: Fighter): AttackRead | null {
  if (f.state !== 'punch' && f.state !== 'kick' && f.state !== 'special') return null
  if (f.state === 'special') {
    const spec = SPECIAL_HIT[f.def.id]
    const total = SPECIAL_END[f.def.id] ?? 36
    const startup = spec?.startup ?? 8
    const active = spec?.active ?? 6
    const recovery = Math.max(1, total - startup - active)
    return {
      name: spec?.name ?? 'SPECIAL',
      startup,
      active,
      recovery,
      now: f.stateFrame,
      phase: f.stateFrame <= startup ? 'STARTUP' : f.stateFrame <= startup + active ? 'ACTIVE' : 'RECOVERY',
      cancel: false,
    }
  }
  const s = strikeSpec(f)
  const standing = f.def.id === 'altman' && !f.strikeAir && !f.strikeLow
  const name = standing
    ? f.strike === 'kick'
      ? 'MEDIUM KICK'
      : 'LIGHT PUNCH'
    : f.strikeAir
      ? f.strike === 'kick'
        ? 'AIR KICK'
        : 'AIR PUNCH'
      : f.strikeLow
        ? f.strike === 'kick'
          ? 'LOW KICK'
          : 'LOW PUNCH'
        : f.strike === 'kick'
          ? 'KICK'
          : 'PUNCH'
  const activeEnd = s.startup + s.active
  const cancelEnd = activeEnd + Math.max(3, Math.round(s.recovery * 0.34))
  const cancel =
    standing && f.didHit && f.grounded && f.stateFrame >= s.startup + 1 && f.stateFrame <= cancelEnd
  const phase = f.stateFrame <= s.startup ? 'STARTUP' : f.stateFrame <= activeEnd ? 'ACTIVE' : 'RECOVERY'
  return { name, startup: s.startup, active: s.active, recovery: s.recovery, now: f.stateFrame, phase, cancel }
}

function beginSpecial(m: Match, f: Fighter) {
  f.power = f.meter
  if (f.def.id === 'ilya') f.meter = 0
  else f.meter -= f.def.cost
  f.hop = f.def.id === 'altman' && f.power >= 80
  f.state = 'special'
  f.stateFrame = 0
  f.didHit = false
  f.grabbing = false
  f.grabTried = false
  f.countered = false
  f.strike = null
  f.vx = 0
  m.fxCount++
  m.sfx.push('special')
  m.callout = f.hop ? 'CAPABILITY JUMP' : f.def.special
  m.calloutT = 46
  if (f.def.id === 'altman') f.shield = 30
  if (f.def.id === 'demis') {
    m.zones.push({ kind: 'slow', x: f.x, r: 138, life: 210, owner: f.player, acc: 0, pulses: 0, used: false })
    f.x = clamp(f.x - f.facing * 170, STAGE_LEFT, STAGE_RIGHT)
    m.fxCount++
  }
  if (f.def.id === 'mira') {
    f.vx = -f.facing * 6.5
    spawnClone(m, f, 46)
    spawnClone(m, f, 92)
  }
}

function spawnClone(m: Match, f: Fighter, ahead: number) {
  m.clones.push({
    x: f.x + f.facing * ahead,
    y: GROUND,
    vx: f.facing * 4.4,
    facing: f.facing,
    life: 48,
    owner: f.player,
    hit: false,
    defId: f.def.id,
  })
  m.fxCount++
}

function tickSpecial(m: Match, f: Fighter, opp: Fighter) {
  const id = f.def.id
  const fr = f.stateFrame
  if (id === 'altman') {
    if (f.hop && fr < 10) {
      if (fr === 1) {
        f.grounded = false
        f.vy = -8.5
        f.y -= 1
      }
      f.vx = f.facing * 2.2
    }
    if (fr === 9) {
      for (const vy of [-2.15, 0, 2.15]) {
        spawnProj(m, {
          kind: 'orb',
          x: f.x + f.facing * 36,
          y: f.y - 86,
          vx: f.facing * 6.4,
          vy,
          w: 28,
          h: 28,
          life: 46,
          damage: 6,
          hitstun: 12,
          knockback: 3.4,
          lift: 0,
          owner: f.player,
          facing: f.facing,
          homing: 0.035,
        })
      }
    }
    if (fr === 9) f.didHit = false
    if (fr >= 9 && fr <= 14) {
      queueMelee(m, f, { ...STRIKES.punch, damage: f.hop ? 12 : 8, reach: 52, y: 104, h: 34, hitstun: 16, knockback: 5, lift: -7 }, 'upper')
    }
  } else if (id === 'elon' && fr === 10) {
    spawnProj(m, {
      kind: 'rocket',
      x: f.x + f.facing * 20,
      y: f.y - 80,
      vx: f.facing * 3.2,
      vy: -10,
      w: 36,
      h: 18,
      life: 90,
      damage: 16,
      hitstun: 26,
      knockback: 7,
      lift: -3,
      owner: f.player,
      facing: f.facing,
      homing: 0,
    })
  } else if (id === 'jensen' && fr === 14) {
    spawnProj(m, {
      kind: 'beam',
      x: f.x + f.facing * 28,
      y: f.y - 92,
      vx: 0,
      vy: 0,
      w: 540,
      h: 26,
      life: 16,
      damage: 20,
      hitstun: 18,
      knockback: 9,
      lift: 0,
      owner: f.player,
      facing: f.facing,
    })
  } else if (id === 'demis' && fr === 8) {
    spawnProj(m, {
      kind: 'stone',
      x: f.x + f.facing * 24,
      y: f.y - 78,
      vx: f.facing * 7.2,
      vy: -1.5,
      w: 22,
      h: 22,
      life: 50,
      damage: 9,
      hitstun: 14,
      knockback: 4,
      lift: 0,
      owner: f.player,
      facing: f.facing,
      gravity: 0.08,
    })
  } else if (id === 'dario') {
    if (fr === 30 && !f.countered) {
      f.didHit = false
      queueMelee(m, f, { ...STRIKES.punch, damage: 6, reach: 70, y: 78, h: 36, hitstun: 12, knockback: 6, lift: 0 }, 'wave')
    }
  } else if (id === 'ilya') {
    if (fr >= 4 && fr <= 16) {
      f.vx = f.facing * 13
      f.armor = 6
      if (fr === 4) f.didHit = false
      queueMelee(
        m,
        f,
        {
          ...STRIKES.punch,
          damage: clamp(10 + f.power * 0.16, 10, 28),
          reach: 64,
          y: 80,
          h: 36,
          hitstun: 20,
          knockback: 11,
          lift: -4,
        },
        'charge',
      )
    }
    if (fr % 2 === 0) {
      m.ghosts.push({ x: f.x, y: f.y, facing: f.facing, life: 8, color: f.def.accent })
      if (m.ghosts.length > 24) m.ghosts.shift()
    }
  } else if (id === 'zuck') {
    if (fr === 8 && !f.grabTried) {
      f.grabTried = true
      const close = Math.abs(opp.x - f.x) < 98 && opp.grounded && opp.invuln <= 0 && opp.hp > 0 && opp.state !== 'ko'
      if (close && isCountering(opp)) {
        triggerCounter(m, opp, f)
      } else if (close) {
        f.grabbing = true
        opp.state = 'grabbed'
        opp.hitstun = 12
        opp.grounded = true
        opp.y = GROUND
      } else {
        spawnProj(m, {
          kind: 'llama',
          x: f.x + f.facing * 30,
          y: f.y - 70,
          vx: f.facing * 7.5,
          vy: 0,
          w: 34,
          h: 28,
          life: 40,
          damage: 10,
          hitstun: 14,
          knockback: 5,
          lift: 0,
          owner: f.player,
          facing: f.facing,
        })
      }
    }
    if (f.grabbing && opp.hp > 0) {
      opp.state = 'grabbed'
      opp.hitstun = 10
      opp.x = f.x + f.facing * 58
      opp.y = GROUND
      opp.vx = 0
      opp.vy = 0
      opp.grounded = true
      opp.facing = f.facing === 1 ? -1 : 1
      if (fr === 12 || fr === 18 || fr === 24 || fr === 30) {
        f.didHit = false
        queueMelee(m, f, { ...STRIKES.punch, damage: 4, reach: 70, y: 70, h: 50, hitstun: 8, knockback: 1, lift: 0 }, 'peck', true)
      }
      if (fr === 36) {
        f.grabbing = false
        f.didHit = false
        queueMelee(m, f, { ...STRIKES.kick, damage: 6, reach: 74, y: 70, h: 40, hitstun: 16, knockback: 9, lift: -2 }, 'toss', false)
      }
    }
  } else if (id === 'satya') {
    if (fr === 8) {
      const chestY = opp.y - 70
      const shots = [
        { x: opp.x - 120, y: 210, delay: 0 },
        { x: opp.x + 130, y: 180, delay: 10 },
      ]
      for (const s of shots) {
        const aim = aimAt(s.x, s.y, opp.x, chestY, 6.4)
        spawnProj(m, {
          kind: 'shot',
          x: s.x,
          y: s.y,
          vx: aim.vx,
          vy: aim.vy,
          w: 16,
          h: 16,
          life: 50,
          delay: s.delay,
          damage: 6,
          hitstun: 12,
          knockback: 3,
          lift: 0,
          owner: f.player,
          facing: f.facing,
          homing: 0.08,
        })
      }
      spawnProj(m, {
        kind: 'drone',
        x: opp.x - 120,
        y: 210,
        vx: 0,
        vy: 0,
        w: 22,
        h: 12,
        life: 36,
        damage: 0,
        hitstun: 0,
        knockback: 0,
        lift: 0,
        owner: f.player,
        facing: 1,
      })
      spawnProj(m, {
        kind: 'drone',
        x: opp.x + 130,
        y: 180,
        vx: 0,
        vy: 0,
        w: 22,
        h: 12,
        life: 46,
        damage: 0,
        hitstun: 0,
        knockback: 0,
        lift: 0,
        owner: f.player,
        facing: -1,
      })
    }
    if (fr === 18) {
      spawnProj(m, {
        kind: 'cloud',
        x: opp.x,
        y: 150,
        vx: 0,
        vy: 8.5,
        w: 150,
        h: 70,
        life: 36,
        damage: 13,
        hitstun: 16,
        knockback: 4,
        lift: -5,
        owner: f.player,
        facing: 1,
      })
    }
  } else if (id === 'feifei' && fr === 8) {
    spawnProj(m, {
      kind: 'crystal',
      x: f.x + f.facing * 24,
      y: f.y - 96,
      vx: f.facing * 6.2,
      vy: -7.2,
      w: 24,
      h: 24,
      life: 80,
      damage: 8,
      hitstun: 12,
      knockback: 3,
      lift: 0,
      owner: f.player,
      facing: f.facing,
      gravity: 0.34,
      expire: 'snare',
    })
  } else if (id === 'lecun' && fr === 10) {
    spawnProj(m, {
      kind: 'cake',
      x: f.x + f.facing * 20,
      y: f.y - 110,
      vx: f.facing * 5.4,
      vy: -6.4,
      w: 40,
      h: 28,
      life: 80,
      damage: 8,
      hitstun: 12,
      knockback: 3,
      lift: 0,
      owner: f.player,
      facing: f.facing,
      gravity: 0.32,
      expire: 'splat',
    })
  } else if (id === 'karpathy') {
    if (fr === 16 || fr === 20 || fr === 24 || fr === 28 || fr === 32) {
      const i = (fr - 16) / 4
      spawnProj(m, {
        kind: 'glyph',
        x: f.x + f.facing * 20,
        y: f.y - 70 - i * 6,
        vx: f.facing * (5.5 + i * 0.25),
        vy: Math.sin(i) * 1.4,
        w: 20,
        h: 20,
        life: 56,
        damage: 5,
        hitstun: i === 4 ? 16 : 10,
        knockback: 2.5,
        lift: 0,
        owner: f.player,
        facing: f.facing,
        homing: 0.06,
      })
    }
  }

  const end = SPECIAL_END[id] ?? 36
  if (fr >= end) {
    if (f.grabbing) {
      f.grabbing = false
      if (opp.state === 'grabbed') {
        opp.state = 'hit'
        opp.hitstun = 10
      }
    }
    f.armor = 0
    f.state = f.grounded ? 'idle' : 'fall'
  }
}

function aimAt(x: number, y: number, tx: number, ty: number, speed: number) {
  const dx = tx - x
  const dy = ty - y
  const len = Math.hypot(dx, dy) || 1
  return { vx: (dx / len) * speed, vy: (dy / len) * speed }
}

function spawnProj(m: Match, p: Partial<Projectile> & Pick<Projectile, 'kind' | 'x' | 'y' | 'owner'>) {
  m.projectiles.push({
    vx: 0,
    vy: 0,
    w: 20,
    h: 20,
    life: 40,
    delay: 0,
    damage: 0,
    hitstun: 0,
    knockback: 0,
    lift: 0,
    hit: false,
    gravity: 0,
    homing: 0,
    facing: 1,
    expire: 'none',
    phase: 0,
    ...p,
  })
  m.fxCount++
  if (m.projectiles.length > 40) m.projectiles.shift()
}

function queueMelee(m: Match, f: Fighter, spec: Strike, kind: string, keepGrab = false) {
  if (f.didHit) return
  const opp = m.fighters[1 - f.player]
  if (opp.invuln > 0 || opp.hp <= 0 || opp.state === 'win') return
  if (!overlap(meleeBox(f, spec), hurtbox(opp))) return
  f.didHit = true
  m.pending.push({
    owner: f.player,
    target: opp.player,
    damage: spec.damage,
    hitstun: spec.hitstun,
    knockback: spec.knockback,
    lift: spec.lift,
    chip: spec.chip,
    grab: false,
    keepGrab,
    sourceX: f.x,
    sourceY: f.y - spec.y,
    kind,
    root: 0,
    tier: tierFromDamage(spec.damage),
  })
}

function meleeBox(f: Fighter, spec: Strike): Box {
  const reach = spec.reach
  const x = f.facing === 1 ? f.x + 18 : f.x - 18 - reach
  return { x, y: f.y - spec.y - spec.h / 2, w: reach, h: spec.h }
}

function hurtbox(f: Fighter): Box {
  const tall = (f.crouching ? 66 : 114) * f.def.scale
  const w = 42 * f.def.scale
  return { x: f.x - w / 2, y: f.y - tall, w, h: tall }
}

function projBox(p: Projectile): Box {
  if (p.kind === 'beam') {
    const x = p.facing === 1 ? p.x : p.x - p.w
    return { x, y: p.y - p.h / 2, w: p.w, h: p.h }
  }
  return { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h }
}

function overlap(a: Box, b: Box) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function updateClones(m: Match) {
  for (const c of m.clones) {
    c.x += c.vx
    c.life--
    if (c.hit || c.life < 8) continue
    const opp = m.fighters[1 - c.owner]
    const box: Box = {
      x: c.facing === 1 ? c.x + 10 : c.x - 48,
      y: c.y - 86,
      w: 40,
      h: 28,
    }
    if (opp.invuln > 0 || opp.hp <= 0) continue
    if (!overlap(box, hurtbox(opp))) continue
    c.hit = true
    c.life = Math.min(c.life, 8)
    m.pending.push({
      owner: c.owner,
      target: opp.player,
      damage: 8,
      hitstun: 14,
      knockback: 5,
      lift: 0,
      chip: 0.25,
      grab: false,
      keepGrab: false,
      sourceX: c.x,
      sourceY: c.y - 70,
      kind: 'clone',
      root: 0,
      tier: tierFromDamage(8),
    })
  }
}

function updateProjectiles(m: Match) {
  for (const p of m.projectiles) {
    if (p.delay > 0) {
      p.delay--
      continue
    }
    p.phase++
    p.life--
    if (p.life <= 0) continue
    if (p.kind === 'rocket' && p.phase > 18) {
      const opp = m.fighters[1 - p.owner]
      const aim = aimAt(p.x, p.y, opp.x, opp.y - 70, 8.2)
      p.vx = p.vx * 0.86 + aim.vx * 0.14
      p.vy = p.vy * 0.86 + aim.vy * 0.14
    } else if (p.homing > 0 && p.kind !== 'drone') {
      const opp = m.fighters[1 - p.owner]
      const aim = aimAt(p.x, p.y, opp.x, opp.y - 70, 7)
      p.vx = p.vx * (1 - p.homing) + aim.vx * p.homing
      p.vy = p.vy * (1 - p.homing) + aim.vy * p.homing
    }
    p.vy += p.gravity
    p.x += p.vx
    p.y += p.vy
    if ((p.expire === 'snare' || p.expire === 'splat') && p.y >= GROUND - 8) {
      dropExpire(m, p)
      p.life = 0
      continue
    }
    if (p.y > GROUND + 40 && p.kind !== 'zone') p.life = 0
    if (p.damage <= 0 || p.hit) continue
    const opp = m.fighters[1 - p.owner]
    if (opp.invuln > 0 || opp.hp <= 0 || opp.state === 'win') continue
    if (!overlap(projBox(p), hurtbox(opp))) continue
    p.hit = true
    if (p.expire === 'snare' || p.expire === 'splat') dropExpire(m, p)
    if (p.kind !== 'beam') p.life = 1
    m.pending.push({
      owner: p.owner,
      target: opp.player,
      damage: p.damage,
      hitstun: p.hitstun,
      knockback: p.knockback,
      lift: p.lift,
      chip: p.kind === 'beam' || p.kind === 'cloud' ? 0.32 : 0.24,
      grab: false,
      keepGrab: false,
      sourceX: p.x,
      sourceY: p.y,
      kind: p.kind,
      root: 0,
      tier: tierFromDamage(p.damage),
    })
  }
}

function dropExpire(m: Match, p: Projectile) {
  if (p.expire === 'snare') {
    m.zones.push({ kind: 'snare', x: p.x, r: 74, life: 160, owner: p.owner, acc: 0, pulses: 0, used: false })
  } else if (p.expire === 'splat') {
    m.zones.push({ kind: 'crumbs', x: p.x, r: 92, life: 70, owner: p.owner, acc: 0, pulses: 0, used: false })
  }
  m.fxCount++
  burst(m, p.x, GROUND - 10, p.expire === 'snare' ? '#ffd0e0' : '#ffb7d5', 10)
}

function updateZones(m: Match) {
  for (const z of m.zones) {
    z.life--
    const opp = m.fighters[1 - z.owner]
    if (opp.hp <= 0 || opp.state === 'ko' || opp.state === 'win') continue
    if (Math.abs(opp.x - z.x) > z.r || !opp.grounded) continue
    if (z.kind === 'slow') {
      opp.slow = 3
      z.acc++
      if (z.acc % 40 === 0) {
        m.pending.push(zoneHit(z, opp.player, 2, 6, 1))
      }
    } else if (z.kind === 'snare' && !z.used && opp.invuln <= 0) {
      z.used = true
      const label = LABELS[Math.floor(rand(m) * LABELS.length)]
      m.pending.push({ ...zoneHit(z, opp.player, 12, 14, 3), root: 78 })
      spark(m, opp.x, opp.y - 130, '#ffd0e0', label)
    } else if (z.kind === 'crumbs') {
      opp.slow = 4
      z.acc++
      if (z.acc % 8 === 0 && z.pulses < 4) {
        z.pulses++
        m.pending.push(zoneHit(z, opp.player, 4, 8, 2))
      }
    }
  }
}

function zoneHit(z: Zone, target: 0 | 1, damage: number, hitstun: number, knockback: number): Pending {
  return {
    owner: z.owner,
    target,
    damage,
    hitstun,
    knockback,
    lift: 0,
    chip: 0.4,
    grab: false,
    keepGrab: false,
    sourceX: z.x,
    sourceY: GROUND,
    kind: z.kind,
    root: 0,
    tier: tierFromDamage(damage),
  }
}

function isCountering(f: Fighter) {
  return f.def.id === 'dario' && f.state === 'special' && f.stateFrame >= 3 && f.stateFrame <= 26 && !f.countered
}

function triggerCounter(m: Match, dario: Fighter, attacker: Fighter) {
  if (dario.countered) return
  dario.countered = true
  dario.flash = 8
  dario.hp = clamp(dario.hp + 10, 0, 100)
  dario.meter = clamp(dario.meter + 16, 0, 100)
  dario.stateFrame = Math.max(dario.stateFrame, 27)
  const dir = Math.sign(attacker.x - dario.x) || -dario.facing
  attacker.hp = clamp(attacker.hp - 14, 0, 100)
  attacker.damageTaken += 14
  if (attacker.hp <= 0) {
    attacker.state = 'ko'
    attacker.hitstun = 40
  } else if (attacker.armor <= 0) {
    attacker.state = 'hit'
    attacker.hitstun = 16
    attacker.vx = dir * 7
    attacker.flash = 6
  }
  m.callout = 'CLAUSE INVOKED'
  m.calloutT = 40
  m.shake = Math.min(16, m.shake + 8)
  m.sfx.push('special')
  burst(m, dario.x, dario.y - 70, dario.def.accent, 14)
}

function resolveHit(m: Match, hit: Pending) {
  if (m.phase !== 'fight') return
  const target = m.fighters[hit.target]
  const attacker = m.fighters[hit.owner]
  if (target.hp <= 0 || target.invuln > 0 || target.state === 'win') return
  if (isCountering(target)) {
    triggerCounter(m, target, attacker)
    return
  }

  const facing = target.facing === (hit.sourceX >= target.x ? 1 : -1) || Math.abs(hit.sourceX - target.x) < 10
  const blocking = target.state === 'block' && facing && !hit.grab
  let dmg = hit.damage
  if (attacker.chain >= 3) dmg *= 0.85
  if (target.shield > 0 && !hit.grab) {
    dmg *= 0.35
    target.shield = 0
    m.callout = 'LOOP SHIELD'
    m.calloutT = 30
  }
  if (target.armor > 0 && !hit.grab) dmg *= 0.72
  if (blocking) dmg = Math.max(1, dmg * hit.chip)
  dmg = Math.max(blocking ? 1 : 0, Math.round(dmg))
  target.hp = clamp(target.hp - dmg, 0, 100)
  target.damageTaken += dmg
  attacker.meter = clamp(attacker.meter + 7 + dmg * 0.25, 0, 100)
  target.meter = clamp(target.meter + 4, 0, 100)
  if (!blocking) {
    if (attacker.chainTimer > 0) attacker.chain += 1
    else attacker.chain = 1
    attacker.chainTimer = 32
  }
  const tier = target.hp <= 0 ? 'heavy' : hit.tier
  const stop = blocking ? 2 : HIT_STOP[tier]
  m.hitstop = Math.max(m.hitstop, stop)
  m.sfx.push(blocking ? 'block' : `hit-${tier}`)
  const contactX = (target.x + hit.sourceX) / 2
  const contactY = hit.sourceY
  feelConnect(m, contactX, contactY, blocking ? '#f4f1ea' : attacker.def.accent, tier, blocking)
  spark(m, contactX, contactY - 28, blocking ? '#f4f1ea' : '#fff6df', blocking ? 'GUARD' : `-${dmg}`)
  target.recoil = blocking ? 4 : tier === 'heavy' ? 12 : tier === 'mid' ? 9 : 6
  target.flash = blocking ? 4 : tier === 'heavy' ? 12 : tier === 'mid' ? 9 : 6
  if (!blocking) {
    m.ghosts.push({
      x: target.x,
      y: target.y,
      facing: target.facing,
      life: tier === 'heavy' ? 22 : tier === 'mid' ? 18 : 14,
      color: '#fff6df',
    })
    if (m.ghosts.length > 24) m.ghosts.shift()
  }

  if (hit.kind === 'rocket') {
    m.bubble = { x: target.x, y: target.y - 150, text: ROASTS[Math.floor(rand(m) * ROASTS.length)], life: 64 }
  }
  if (hit.root > 0) target.root = hit.root

  if (target.hp <= 0) {
    target.state = 'ko'
    target.hitstun = 60
    target.grounded = false
    target.vy = -7
    target.vx = (Math.sign(target.x - hit.sourceX) || 1) * 3
    m.koFlash = 16
    burst(m, target.x, target.y - 60, '#e7ff52', 18)
    noteAdv(m, attacker, target.hitstun)
    return
  }

  if (hit.keepGrab) {
    noteAdv(m, attacker, target.hitstun)
    return
  }

  if (blocking) {
    target.blockstun = Math.max(target.blockstun, Math.round(hit.hitstun * 0.42))
    const dir = Math.sign(target.x - hit.sourceX) || -target.facing
    target.vx = dir * Math.min(3.5, hit.knockback * 0.35)
    noteAdv(m, attacker, target.blockstun)
    return
  }

  if (target.armor > 0) {
    const dir = Math.sign(target.x - hit.sourceX) || -target.facing
    target.vx = dir * 1.5
    noteAdv(m, attacker, 0)
    return
  }

  const dir = Math.sign(target.x - hit.sourceX) || -attacker.facing
  target.vx = dir * hit.knockback
  if (hit.lift < -2) {
    target.grounded = false
    target.vy = hit.lift
    target.y -= 1
    target.state = 'launch'
    target.hitstun = hit.hitstun
  } else {
    target.state = 'hit'
    target.hitstun = hit.hitstun
    target.crouching = false
  }
  noteAdv(m, attacker, target.hitstun)
}

function separate(m: Match) {
  const a = m.fighters[0]
  const b = m.fighters[1]
  if (a.grabbing || b.grabbing || a.state === 'grabbed' || b.state === 'grabbed') return
  if (Math.abs(a.y - b.y) > 90) return
  const min = 46
  const dx = b.x - a.x
  const adx = Math.abs(dx)
  if (adx >= min) return
  const push = (min - adx) / 2
  const dir = dx === 0 ? 1 : Math.sign(dx)
  if (a.state !== 'ko' && a.state !== 'win') a.x -= dir * push
  if (b.state !== 'ko' && b.state !== 'win') b.x += dir * push
}

function clampFighter(f: Fighter) {
  f.x = clamp(f.x, STAGE_LEFT, STAGE_RIGHT)
}

function checkRound(m: Match) {
  if (m.phase !== 'fight') return
  const dead0 = m.fighters[0].hp <= 0
  const dead1 = m.fighters[1].hp <= 0
  if (dead0 || dead1) {
    const w: 0 | 1 =
      dead0 && !dead1 ? 1 : dead1 && !dead0 ? 0 : m.fighters[0].damageTaken <= m.fighters[1].damageTaken ? 0 : 1
    m.koHold = w
    m.hitstop = Math.max(m.hitstop, HIT_STOP.heavy)
    return
  }
  if (m.timer <= 0) {
    const h0 = m.fighters[0].hp
    const h1 = m.fighters[1].hp
    let w: 0 | 1 = h0 === h1 ? (m.fighters[0].meter >= m.fighters[1].meter ? 0 : 1) : h0 > h1 ? 0 : 1
    endRound(m, w)
    m.sub = 'CLOCK ZERO. THE LOSS CURVE DECIDES.'
  }
}

function endRound(m: Match, winner: 0 | 1) {
  if (m.phase !== 'fight') return
  m.koHold = null
  const champ = m.fighters[winner]
  const loser = m.fighters[1 - winner]
  champ.wins += 1
  if (champ.hp <= 0) champ.hp = 1
  champ.state = 'win'
  champ.vx = 0
  champ.hitstun = 0
  if (loser.hp <= 0) {
    loser.state = 'ko'
    if (loser.grounded) {
      loser.grounded = false
      loser.vy = -6
    }
  } else {
    loser.state = 'hit'
    loser.hitstun = 20
  }
  m.phase = 'roundend'
  m.phaseTimer = champ.wins >= 2 ? 90 : 120
  m.hitstop = 0
  m.projectiles = []
  m.zones = []
  m.clones = []
  m.pending = []
  m.banner = `${champ.def.last} TAKES THE ROUND`
  m.sub = champ.wins >= 2 ? champ.def.catchphrase : 'FIRST TO TWO.'
  m.callout = champ.wins >= 2 ? 'SYSTEM HALT' : m.banner
  m.calloutT = 80
  if (champ.wins >= 2) m.winner = winner
  m.sfx.push(loser.hp <= 0 ? 'ko' : 'round')
  burst(m, champ.x, champ.y - 80, champ.def.accent, 16)
}

function tierFromDamage(damage: number): HitTier {
  if (damage >= 15) return 'heavy'
  if (damage >= 9) return 'mid'
  return 'light'
}

function tierIndex(tier: HitTier): 0 | 1 | 2 {
  return tier === 'heavy' ? 2 : tier === 'mid' ? 1 : 0
}

function attackerRemain(f: Fighter): number {
  if (f.state === 'punch' || f.state === 'kick') {
    const s = strikeSpec(f)
    return Math.max(0, s.startup + s.active + s.recovery - f.stateFrame)
  }
  if (f.state === 'special') {
    const total = SPECIAL_END[f.def.id] ?? 36
    return Math.max(0, total - f.stateFrame)
  }
  return 0
}

function noteAdv(m: Match, attacker: Fighter, stun: number) {
  m.lastAdv = stun - attackerRemain(attacker)
  m.lastAdvT = 90
}

function feelConnect(m: Match, x: number, y: number, color: string, tier: HitTier, blocked: boolean) {
  const i = tierIndex(tier)
  const scale = blocked ? 0.45 : 1
  const mid = (m.fighters[0].x + m.fighters[1].x) / 2
  const dir = Math.sign(x - mid) || 1
  m.zoomKick = Math.max(m.zoomKick, [0.06, 0.12, 0.2][i] * scale)
  m.panKick = dir * [22, 40, 62][i] * scale
  m.kickX = dir * [7, 12, 18][i] * scale
  m.kickY = [3, 6, 9][i] * scale
  m.impact = 1
  m.impactTier = blocked ? 0 : i
  m.impactX = x
  m.impactY = y
  m.shake = Math.max(m.shake, [8, 12, 16][i] * (blocked ? 0.55 : 1))
  const count = blocked ? 6 : [9, 14, 20][i]
  const life = [14, 20, 28][i]
  for (let k = 0; k < count; k++) {
    const a = (Math.PI * 2 * k) / count
    const sp = (blocked ? 2 : [3.4, 5, 7][i]) + (k % 3) * 0.6
    const kind = k % 5 === 0 ? 'streak' : k % 2 === 0 ? 'shard' : 'dot'
    m.sparks.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 1.6,
      life,
      max: life,
      color: k % 3 === 0 ? '#fff' : color,
      size: [4, 6, 9][i],
      rot: a,
      kind,
    })
  }
  if (!blocked && i > 0) {
    m.sparks.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 12 + i * 6,
      max: 12 + i * 6,
      color,
      size: 16 + i * 14,
      rot: 0,
      kind: 'ring',
    })
    if (i === 2) {
      m.sparks.push({
        x,
        y,
        vx: 0,
        vy: 0,
        life: 18,
        max: 18,
        color: '#fff6df',
        size: 46,
        rot: 0,
        kind: 'ring',
      })
    }
  }
  m.sparks.push({
    x,
    y,
    vx: 0,
    vy: 0,
    life: 8 + i * 4,
    max: 8 + i * 4,
    color,
    size: [26, 42, 68][i],
    rot: 0,
    kind: 'flash',
  })
  const slashes = blocked ? 1 : 2 + i
  for (let s = 0; s < slashes; s++) {
    m.sparks.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 10 + i * 4,
      max: 10 + i * 4,
      color,
      size: [34, 52, 78][i],
      rot: -0.85 + s * 0.62,
      kind: 'slash',
    })
  }
  if (!blocked) {
    const dust = 5 + i * 3
    for (let k = 0; k < dust; k++) {
      m.sparks.push({
        x: x + (k - dust / 2) * 7,
        y: GROUND - 6,
        vx: (k % 2 === 0 ? -1 : 1) * (1.4 + i * 0.6),
        vy: -0.35 - (k % 3) * 0.25,
        life: 16 + i * 4,
        max: 16 + i * 4,
        color: k % 2 === 0 ? '#d9cbb8' : '#fff6df',
        size: 3 + i,
        rot: 0,
        kind: 'dot',
      })
    }
  }
  if (m.sparks.length > 180) m.sparks.splice(0, m.sparks.length - 180)
}

function burst(m: Match, x: number, y: number, color: string, n: number) {
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n
    const sp = 1.5 + (i % 4)
    m.sparks.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 1,
      life: 16 + (i % 8),
      max: 22,
      color,
      size: 3 + (i % 3),
      rot: a,
      kind: i % 5 === 0 ? 'ring' : 'dot',
    })
  }
  if (m.sparks.length > 180) m.sparks.splice(0, m.sparks.length - 180)
}

function spark(m: Match, x: number, y: number, color: string, text: string) {
  m.sparks.push({
    x,
    y,
    vx: 0,
    vy: -1.4,
    life: 36,
    max: 36,
    color,
    size: 18,
    text,
    rot: 0,
    kind: 'text',
  })
}

function decayFx(m: Match, freeze: boolean) {
  const hold = freeze || m.hitstop > 0
  if (!freeze) m.frame++
  if (hold) return
  m.shake *= 0.9
  if (m.shake < 0.25) m.shake = 0
  m.zoomKick *= 0.84
  m.panKick *= 0.84
  m.kickX *= 0.78
  m.kickY *= 0.78
  m.impact *= 0.72
  if (m.zoomKick < 0.004) m.zoomKick = 0
  if (Math.abs(m.panKick) < 0.4) m.panKick = 0
  if (m.calloutT > 0) m.calloutT--
  if (m.lastAdvT > 0) m.lastAdvT--
  if (m.koFlash > 0) m.koFlash--
  if (m.bubble) {
    m.bubble.life--
    m.bubble.y -= 0.25
    if (m.bubble.life <= 0) m.bubble = null
  }
  for (const s of m.sparks) {
    if (s.kind !== 'flash' && s.kind !== 'ring' && s.kind !== 'slash') {
      s.x += s.vx
      s.y += s.vy
      s.vy += s.kind === 'text' ? 0 : 0.18
    }
    s.life--
  }
  m.sparks = m.sparks.filter((s) => s.life > 0)
  for (const g of m.ghosts) g.life--
  m.ghosts = m.ghosts.filter((g) => g.life > 0)
  if (m.phase === 'fight' && m.frame % 45 === 0) {
    for (const f of m.fighters) if (f.hp > 0) f.meter = clamp(f.meter + 1, 0, 100)
  }
}
