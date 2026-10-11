import type { FighterDef } from './roster'

export type Mode = 'cpu' | 'local' | 'demo'

export type State =
  | 'idle'
  | 'walk'
  | 'crouch'
  | 'jump'
  | 'fall'
  | 'punch'
  | 'kick'
  | 'special'
  | 'block'
  | 'hit'
  | 'launch'
  | 'getup'
  | 'grabbed'
  | 'ko'
  | 'win'

export interface Pad {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
  punch: boolean
  kick: boolean
  special: boolean
  block: boolean
  punchPressed: boolean
  kickPressed: boolean
  specialPressed: boolean
}

export interface Fighter {
  def: FighterDef
  player: 0 | 1
  x: number
  y: number
  vx: number
  vy: number
  facing: 1 | -1
  hp: number
  meter: number
  wins: number
  state: State
  stateFrame: number
  grounded: boolean
  crouching: boolean
  airUsed: boolean
  hitstun: number
  blockstun: number
  invuln: number
  armor: number
  shield: number
  root: number
  slow: number
  flash: number
  chain: number
  chainTimer: number
  didHit: boolean
  power: number
  hop: boolean
  grabbing: boolean
  grabTried: boolean
  countered: boolean
  cooldown: number
  react: number
  blockT: number
  buf: { k: 'punch' | 'kick' | 'special'; n: number } | null
  anim: number
  strike: 'punch' | 'kick' | null
  strikeAir: boolean
  strikeLow: boolean
  damageTaken: number
  recoil: number
}

export interface Projectile {
  kind: string
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  life: number
  delay: number
  owner: 0 | 1
  damage: number
  hitstun: number
  knockback: number
  lift: number
  hit: boolean
  gravity: number
  homing: number
  facing: 1 | -1
  expire: 'none' | 'snare' | 'splat'
  phase: number
}

export interface Zone {
  kind: 'slow' | 'snare' | 'crumbs'
  x: number
  r: number
  life: number
  owner: 0 | 1
  acc: number
  pulses: number
  used: boolean
}

export interface Clone {
  x: number
  y: number
  vx: number
  facing: 1 | -1
  life: number
  owner: 0 | 1
  hit: boolean
  defId: string
}

export type HitTier = 'light' | 'mid' | 'heavy'

export interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  size: number
  text?: string
  rot: number
  kind: 'dot' | 'text' | 'ring' | 'streak' | 'shard' | 'flash' | 'slash'
}

export interface Ghost {
  x: number
  y: number
  facing: 1 | -1
  life: number
  color: string
}

export interface Pending {
  owner: 0 | 1
  target: 0 | 1
  damage: number
  hitstun: number
  knockback: number
  lift: number
  chip: number
  grab: boolean
  keepGrab: boolean
  sourceX: number
  sourceY: number
  kind: string
  root: number
  tier: HitTier
}

export interface Bubble {
  x: number
  y: number
  text: string
  life: number
}

export interface Match {
  fighters: [Fighter, Fighter]
  projectiles: Projectile[]
  zones: Zone[]
  clones: Clone[]
  sparks: Spark[]
  ghosts: Ghost[]
  pending: Pending[]
  mode: Mode
  phase: 'intro' | 'fight' | 'roundend' | 'matchend'
  phaseTimer: number
  round: number
  timer: number
  hitstop: number
  shake: number
  frame: number
  seed: number
  banner: string
  sub: string
  callout: string
  calloutT: number
  bubble: Bubble | null
  sfx: string[]
  koFlash: number
  winner: 0 | 1 | null
  fxCount: number
  zoomKick: number
  panKick: number
  kickX: number
  kickY: number
  impact: number
  impactTier: 0 | 1 | 2
  impactX: number
  impactY: number
  lastAdv: number
  lastAdvT: number
  koHold: 0 | 1 | null
}

export function emptyPad(): Pad {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    punch: false,
    kick: false,
    special: false,
    block: false,
    punchPressed: false,
    kickPressed: false,
    specialPressed: false,
  }
}
