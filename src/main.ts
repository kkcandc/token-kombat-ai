import './style.css'
import { ArcadeAudio } from './game/audio'
import { createMatch, skipIntro, stepMatch } from './game/match'
import { renderMatch, renderPortrait } from './game/render'
import { ROSTER } from './game/roster'
import { emptyPad, type Match, type Mode, type Pad } from './game/types'

type Screen = 'title' | 'mode' | 'select' | 'fight'

const HELP = [
  ['Move', 'P1 WASD · P2 arrow keys'],
  ['Jump / crouch', 'Up / W · Down / S'],
  ['Punch', 'P1 J or Space · P2 N'],
  ['Kick', 'P1 K · P2 M'],
  ['Special', 'P1 L · P2 comma'],
  ['Block', 'P1 I or Left Shift · P2 period or Right Shift'],
  ['Round', 'First to two. Meter funds the special.'],
  ['Menus', 'Enter confirms · Esc pauses · M mutes'],
]

const audio = new ArcadeAudio()
const keys = new Set<string>()
const touch = new Set<string>()

const screens: Record<Screen, HTMLElement> = {
  title: document.getElementById('screen-title')!,
  mode: document.getElementById('screen-mode')!,
  select: document.getElementById('screen-select')!,
  fight: document.getElementById('screen-fight')!,
}

const attractCanvas = document.getElementById('attract') as HTMLCanvasElement
const gameCanvas = document.getElementById('game') as HTMLCanvasElement
const attractCtx = attractCanvas.getContext('2d')!
const gameCtx = gameCanvas.getContext('2d')!
const rosterEl = document.getElementById('roster')!
const blurbName = document.getElementById('blurb-name')!
const blurb = document.getElementById('blurb')!
const startBtn = document.getElementById('btn-start') as HTMLButtonElement
const slotBtns = [document.getElementById('slot-0')!, document.getElementById('slot-1')!]
const resultEl = document.getElementById('result')!
const pauseEl = document.getElementById('pause-card')!
const helpModal = document.getElementById('modal-help')!

let screen: Screen = 'title'
let mode: Mode = 'cpu'
let cursor = 0
let slot: 0 | 1 = 0
let picks: [string | null, string | null] = [null, null]
let match: Match | null = null
let titleMatch = randomDemo()
let titleHold = 0
let paused = false
let shownResult = false
let dpr = 1
let prev = emptyPad()
let prev2 = emptyPad()

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

function randomDemo() {
  const a = ROSTER[Math.floor(Math.random() * ROSTER.length)].id
  let b = ROSTER[Math.floor(Math.random() * ROSTER.length)].id
  if (b === a) b = ROSTER[(ROSTER.findIndex((f) => f.id === a) + 3) % ROSTER.length].id
  return createMatch(a, b, 'demo', (Math.random() * 1e9) >>> 0)
}

function show(next: Screen) {
  screen = next
  for (const key of Object.keys(screens) as Screen[]) {
    screens[key].classList.toggle('hidden', key !== next)
  }
  if (next === 'select') paintSlots()
}

function helpHtml() {
  return `<div class="help-grid">${HELP.map(([k, v]) => `<div><strong>${k}</strong><span>${v}</span></div>`).join('')}</div>`
}

document.getElementById('help-home')!.innerHTML = helpHtml()
document.getElementById('help-copy')!.innerHTML = helpHtml()

function paintRoster() {
  rosterEl.innerHTML = ''
  ROSTER.forEach((def, i) => {
    const btn = document.createElement('button')
    btn.className = 'card'
    btn.type = 'button'
    btn.dataset.id = def.id
    btn.innerHTML = `<canvas width="220" height="150"></canvas><div class="meta"><span class="nm"></span><span class="sp"></span></div>`
    btn.querySelector('.nm')!.textContent = def.name
    btn.querySelector('.sp')!.textContent = def.special
    btn.addEventListener('click', () => {
      cursor = i
      assign(def.id)
    })
    btn.addEventListener('pointerenter', () => {
      cursor = i
      showBlurb()
      markCards()
    })
    rosterEl.appendChild(btn)
  })
}

function drawCards(frame: number) {
  const cards = rosterEl.querySelectorAll<HTMLButtonElement>('.card')
  cards.forEach((card) => {
    const def = ROSTER.find((f) => f.id === card.dataset.id)!
    const canvas = card.querySelector('canvas')!
    const ctx = canvas.getContext('2d')
    if (ctx) renderPortrait(ctx, def, frame)
  })
}

function markCards() {
  const id = ROSTER[cursor]?.id
  rosterEl.querySelectorAll<HTMLButtonElement>('.card').forEach((card) => {
    card.classList.toggle('cursor', card.dataset.id === id)
    card.classList.toggle('on', card.dataset.id === picks[0] || card.dataset.id === picks[1])
  })
  showBlurb()
}

function showBlurb() {
  const def = ROSTER[cursor]
  if (!def) return
  blurbName.textContent = `${def.name} — ${def.special}`
  blurb.textContent = def.blurb
}

function paintSlots() {
  const labels = mode === 'local' ? ['Player 1', 'Player 2'] : ['You', 'CPU']
  picks.forEach((id, i) => {
    const def = id ? ROSTER.find((f) => f.id === id) : null
    slotBtns[i].innerHTML = def
      ? `<span>${labels[i]}</span><b>${def.name}</b><span>${def.special}</span>`
      : `<span>${labels[i]}</span><b>Open slot</b><span>Pick from the grid</span>`
    slotBtns[i].classList.toggle('active', slot === i)
  })
  startBtn.disabled = !picks[0] || !picks[1]
  markCards()
}

function assign(id: string) {
  picks[slot] = id
  audio.play('ui')
  if (slot === 0 && !picks[1]) slot = 1
  else if (slot === 1 && !picks[0]) slot = 0
  paintSlots()
}

function moveCursor(dx: number, dy: number) {
  const cols = window.innerWidth < 640 ? 2 : window.innerWidth < 900 ? 3 : 4
  const next = cursor + dx + dy * cols
  if (next >= 0 && next < ROSTER.length) cursor = next
  markCards()
  rosterEl.querySelector<HTMLButtonElement>('.card.cursor')?.scrollIntoView({ block: 'nearest' })
}

slotBtns[0].addEventListener('click', () => {
  slot = 0
  paintSlots()
})
slotBtns[1].addEventListener('click', () => {
  slot = 1
  paintSlots()
})

function bootFight(p1: string, p2: string) {
  match = createMatch(p1, p2, mode, (Math.random() * 1e9) >>> 0)
  paused = false
  shownResult = false
  pauseEl.classList.add('hidden')
  resultEl.classList.add('hidden')
  show('fight')
  audio.unlock()
}

document.getElementById('btn-enter')!.addEventListener('click', () => {
  audio.unlock()
  audio.play('ui')
  show('mode')
})
document.getElementById('btn-how')!.addEventListener('click', () => helpModal.classList.remove('hidden'))
document.getElementById('btn-close-help')!.addEventListener('click', () => helpModal.classList.add('hidden'))
document.getElementById('btn-mode-back')!.addEventListener('click', () => show('title'))
document.getElementById('btn-select-back')!.addEventListener('click', () => show('mode'))
document.getElementById('btn-cpu')!.addEventListener('click', () => {
  mode = 'cpu'
  picks = [null, null]
  slot = 0
  audio.play('ui')
  show('select')
})
document.getElementById('btn-local')!.addEventListener('click', () => {
  mode = 'local'
  picks = [null, null]
  slot = 0
  audio.play('ui')
  show('select')
})
document.getElementById('btn-random')!.addEventListener('click', () => {
  const pool = ROSTER.map((f) => f.id).filter((id) => id !== picks[0])
  const id = pool[Math.floor(Math.random() * pool.length)]
  slot = 1
  assign(id)
})
startBtn.addEventListener('click', () => {
  if (picks[0] && picks[1]) bootFight(picks[0], picks[1])
})
document.getElementById('btn-pause')!.addEventListener('click', () => togglePause())
document.getElementById('btn-resume')!.addEventListener('click', () => togglePause(false))
document.getElementById('btn-quit')!.addEventListener('click', () => {
  paused = false
  match = null
  show('select')
})
document.getElementById('btn-rematch')!.addEventListener('click', () => {
  if (picks[0] && picks[1]) bootFight(picks[0], picks[1])
})
document.getElementById('btn-new')!.addEventListener('click', () => {
  match = null
  show('select')
})
document.getElementById('btn-mute')!.addEventListener('click', () => {
  const muted = audio.toggleMute()
  document.getElementById('btn-mute')!.textContent = muted ? 'Sound off' : 'Sound on'
})
document.getElementById('btn-music')!.addEventListener('click', () => {
  const on = audio.toggleMusic()
  document.getElementById('btn-music')!.textContent = on ? 'Music on' : 'Music off'
})

function togglePause(force?: boolean) {
  if (screen !== 'fight' || !match || match.phase === 'matchend') return
  paused = force ?? !paused
  pauseEl.classList.toggle('hidden', !paused)
}

function fit(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = 1280 * dpr
  canvas.height = 720 * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

window.addEventListener('resize', () => {
  fit(attractCanvas, attractCtx)
  fit(gameCanvas, gameCtx)
})
fit(attractCanvas, attractCtx)
fit(gameCanvas, gameCtx)

window.addEventListener('keydown', (e) => {
  if (e.repeat) return
  keys.add(e.code)
  const fightKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD']
  if (screen === 'fight' && fightKeys.includes(e.code)) e.preventDefault()
  if ((screen === 'select' || screen === 'title' || screen === 'mode') && e.code.startsWith('Arrow')) e.preventDefault()
  if (e.code === 'KeyM' && screen === 'fight') {
    const muted = audio.toggleMute()
    document.getElementById('btn-mute')!.textContent = muted ? 'Sound off' : 'Sound on'
  }
  if (e.code === 'Escape') {
    if (!helpModal.classList.contains('hidden')) helpModal.classList.add('hidden')
    else togglePause()
  }
  if (e.code === 'Enter') {
    if (screen === 'title') {
      audio.unlock()
      show('mode')
    } else if (screen === 'select') {
      if (picks[0] && picks[1] && (picks[slot] === ROSTER[cursor].id || document.activeElement === startBtn)) {
        bootFight(picks[0], picks[1])
      } else assign(ROSTER[cursor].id)
    } else if (screen === 'fight' && match?.phase === 'intro') skipIntro(match)
  }
  if (screen === 'select') {
    if (e.code === 'ArrowLeft') moveCursor(-1, 0)
    if (e.code === 'ArrowRight') moveCursor(1, 0)
    if (e.code === 'ArrowUp') moveCursor(0, -1)
    if (e.code === 'ArrowDown') moveCursor(0, 1)
  }
})
window.addEventListener('keyup', (e) => keys.delete(e.code))
window.addEventListener('blur', () => keys.clear())

document.querySelectorAll<HTMLButtonElement>('#touch button').forEach((btn) => {
  const bit = btn.dataset.b!
  const down = (e: Event) => {
    e.preventDefault()
    touch.add(bit)
  }
  const up = (e: Event) => {
    e.preventDefault()
    touch.delete(bit)
  }
  btn.addEventListener('pointerdown', down)
  btn.addEventListener('pointerup', up)
  btn.addEventListener('pointerleave', up)
  btn.addEventListener('pointercancel', up)
})

function held(codes: string[], bits: string[] = []) {
  return codes.some((c) => keys.has(c)) || bits.some((b) => touch.has(b))
}

function readPad(
  map: { left: string[]; right: string[]; up: string[]; down: string[]; punch: string[]; kick: string[]; special: string[]; block: string[] },
  touchOn: boolean,
  previous: Pad,
): Pad {
  const t = (bit: string) => (touchOn && touch.has(bit) ? [bit] : [])
  const pad: Pad = {
    left: held(map.left, t('left')),
    right: held(map.right, t('right')),
    up: held(map.up, t('up')),
    down: held(map.down, t('down')),
    punch: held(map.punch, t('punch')),
    kick: held(map.kick, t('kick')),
    special: held(map.special, t('special')),
    block: held(map.block, t('block')),
    punchPressed: false,
    kickPressed: false,
    specialPressed: false,
  }
  pad.punchPressed = pad.punch && !previous.punch
  pad.kickPressed = pad.kick && !previous.kick
  pad.specialPressed = pad.special && !previous.special
  return pad
}

const p1map = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  punch: ['KeyJ', 'Space', 'KeyF'],
  kick: ['KeyK', 'KeyG'],
  special: ['KeyL', 'KeyH'],
  block: ['KeyI', 'ShiftLeft'],
}
const p1mapLocal = {
  ...p1map,
  left: ['KeyA'],
  right: ['KeyD'],
  up: ['KeyW'],
  down: ['KeyS'],
}
const p2map = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  punch: ['KeyN', 'Numpad1'],
  kick: ['KeyM', 'Numpad2'],
  special: ['Comma', 'Numpad3'],
  block: ['Period', 'ShiftRight', 'Numpad0'],
}

function pads(): [Pad, Pad] {
  if (mode === 'local') {
    const a = readPad(p1mapLocal, true, prev)
    const b = readPad(p2map, false, prev2)
    prev = a
    prev2 = b
    return [a, b]
  }
  const a = readPad(p1map, true, prev)
  prev = a
  return [a, emptyPad()]
}

function playSfx(list: string[]) {
  const uniq = new Set(list)
  for (const name of uniq) audio.play(name)
}

let last = performance.now()
let acc = 0
let frame = 0

function loop(now: number) {
  acc += Math.min(50, now - last)
  last = now
  frame++
  while (acc >= 1000 / 60) {
    acc -= 1000 / 60
    if (screen === 'title') {
      stepMatch(titleMatch, [emptyPad(), emptyPad()])
      if (titleMatch.phase === 'matchend') {
        titleHold++
        if (titleHold > 150) {
          titleMatch = randomDemo()
          titleHold = 0
        }
      }
    } else if (screen === 'fight' && match && !paused) {
      const input = pads()
      stepMatch(match, input)
      playSfx(match.sfx)
      audio.tickMusic(match.frame)
      if (match.phase === 'matchend' && !shownResult) {
        shownResult = true
        const champ = match.fighters[match.winner ?? 0]
        document.getElementById('result-title')!.textContent = champ.def.catchphrase
        document.getElementById('result-sub')!.textContent = `${champ.def.name} takes the Token Coliseum. ${champ.def.special} got the last word.`
        resultEl.classList.remove('hidden')
      }
    }
  }
  if (screen === 'title') {
    attractCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderMatch(attractCtx, titleMatch, reduce)
  } else if (screen === 'select' && frame % 2 === 0) {
    drawCards(frame)
  } else if (screen === 'fight' && match) {
    gameCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderMatch(gameCtx, match, reduce)
  }
  requestAnimationFrame(loop)
}

paintRoster()
markCards()
window.__TOKEN = () => (screen === 'fight' ? match : titleMatch)
requestAnimationFrame(loop)
