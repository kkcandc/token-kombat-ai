import { GROUND } from './game/constants'
import { createMatch, stepMatch } from './game/match'
import { ROSTER } from './game/roster'
import { emptyPad, type Match, type Pad } from './game/types'

const failures: string[] = []

function assert(cond: boolean, msg: string) {
  if (!cond) failures.push(msg)
}

function finite(m: Match, label: string) {
  for (const f of m.fighters) {
    assert(Number.isFinite(f.hp) && f.hp >= 0 && f.hp <= 100, `${label} hp ${f.def.id} ${f.hp}`)
    assert(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.meter), `${label} nan ${f.def.id}`)
    assert(f.meter >= 0 && f.meter <= 100, `${label} meter ${f.def.id} ${f.meter}`)
  }
}

function toFight(m: Match) {
  const pad = emptyPad()
  for (let i = 0; i < 140 && m.phase !== 'fight'; i++) stepMatch(m, [pad, emptyPad()])
  assert(m.phase === 'fight', 'never reached fight')
}

function place(m: Match, x0: number, x1: number) {
  const a = m.fighters[0]
  const b = m.fighters[1]
  a.x = x0
  b.x = x1
  a.y = GROUND
  b.y = GROUND
  a.grounded = true
  b.grounded = true
  a.invuln = 0
  b.invuln = 0
  a.facing = x1 >= x0 ? 1 : -1
  b.facing = x0 >= x1 ? 1 : -1
}

function punchOnce(fromRight = false): number {
  const m = createMatch('altman', 'jensen', 'local', 3)
  toFight(m)
  const pad = emptyPad()
  const idle = emptyPad()
  let seen = false
  const before = m.fighters[1].hp
  for (let i = 0; i < 40; i++) {
    place(m, 800, 868)
    const p: Pad = { ...pad, punch: true, punchPressed: i === 0 }
    const block: Pad = fromRight ? { ...idle, block: true } : idle
    stepMatch(m, [p, block])
    if (m.fighters[1].hp < before) seen = true
  }
  assert(seen, fromRight ? 'block punch should still chip' : 'punch should damage')
  return before - m.fighters[1].hp
}

const openDmg = punchOnce(false)
const chipDmg = punchOnce(true)
assert(openDmg > chipDmg, `block should reduce damage open=${openDmg} chip=${chipDmg}`)

{
  const m = createMatch('altman', 'jensen', 'local', 9)
  toFight(m)
  for (let i = 0; i < 900 && m.fighters[0].wins < 1 && m.phase !== 'matchend'; i++) {
    if (m.phase === 'fight') {
      place(m, 800, 860)
      m.fighters[1].state = m.fighters[1].state === 'ko' ? 'ko' : 'idle'
    }
    const pad = emptyPad()
    pad.punch = true
    pad.punchPressed = i % 18 === 0
    stepMatch(m, [pad, emptyPad()])
    finite(m, 'ko-loop')
  }
  assert(m.fighters[0].wins >= 1 || m.phase === 'roundend' || m.phase === 'matchend', 'round did not end')
}

{
  const m = createMatch('ilya', 'satya', 'local', 4)
  toFight(m)
  m.fighters[1].hp = 8
  place(m, 800, 860)
  for (let i = 0; i < 80 && m.phase === 'fight'; i++) {
    place(m, 800, 860)
    const pad = emptyPad()
    pad.punchPressed = i % 12 === 0
    pad.punch = true
    stepMatch(m, [pad, emptyPad()])
  }
  assert(m.fighters[0].wins >= 1, 'expected a round win')
  const wins = m.fighters[0].wins
  for (let i = 0; i < 1200 && m.phase !== 'matchend'; i++) {
    if (m.phase === 'fight') {
      place(m, 800, 860)
      m.fighters[1].hp = Math.min(m.fighters[1].hp, 10)
    }
    const pad = emptyPad()
    pad.punchPressed = i % 10 === 0
    pad.punch = true
    stepMatch(m, [pad, emptyPad()])
    finite(m, 'match')
  }
  assert(m.phase === 'matchend' && m.fighters[0].wins >= 2 && m.fighters[0].wins >= wins, 'first to two failed')
  assert(m.banner === m.fighters[0].def.catchphrase || m.phase === 'matchend', 'catchphrase missing')
}

for (const def of ROSTER) {
  const m = createMatch(def.id, 'altman', 'local', 11)
  toFight(m)
  place(m, 500, 1200)
  m.fighters[0].meter = 100
  m.fighters[0].invuln = 0
  const before = m.fxCount
  const pad = emptyPad()
  pad.special = true
  pad.specialPressed = true
  stepMatch(m, [pad, emptyPad()])
  for (let i = 0; i < 80; i++) stepMatch(m, [emptyPad(), emptyPad()])
  finite(m, def.id)
  assert(m.fighters[0].meter < 100, `${def.id} meter not spent`)
  assert(m.fxCount > before, `${def.id} special produced no effect`)
}

{
  const m = createMatch('dario', 'elon', 'local', 6)
  toFight(m)
  place(m, 800, 868)
  m.fighters[0].meter = 100
  m.fighters[0].invuln = 0
  m.fighters[1].invuln = 0
  const pad = emptyPad()
  pad.specialPressed = true
  stepMatch(m, [pad, emptyPad()])
  for (let i = 0; i < 4; i++) {
    place(m, 800, 868)
    stepMatch(m, [emptyPad(), emptyPad()])
  }
  for (let i = 0; i < 12; i++) {
    place(m, 800, 868)
    const punch = emptyPad()
    punch.punch = true
    punch.punchPressed = i === 0
    stepMatch(m, [emptyPad(), punch])
  }
  assert(m.fighters[1].hp < 100, `counter should reflect, elon hp ${m.fighters[1].hp}`)
  assert(m.fighters[0].hp >= 95, `dario should be mostly safe, hp ${m.fighters[0].hp}`)
}

{
  const m = createMatch('jensen', 'mira', 'local', 8)
  toFight(m)
  place(m, 700, 860)
  m.fighters[0].meter = 100
  m.fighters[0].invuln = 0
  m.fighters[1].invuln = 0
  const pad = emptyPad()
  pad.specialPressed = true
  stepMatch(m, [pad, emptyPad()])
  for (let i = 0; i < 24; i++) {
    if (m.phase === 'fight') place(m, 700, 860)
    stepMatch(m, [emptyPad(), emptyPad()])
  }
  assert(m.fighters[1].hp < 100, `beam should connect, hp ${m.fighters[1].hp}`)
}

{
  const m = createMatch('demis', 'feifei', 'local', 2)
  toFight(m)
  m.fighters[0].meter = 100
  const pad = emptyPad()
  pad.specialPressed = true
  stepMatch(m, [pad, emptyPad()])
  assert(m.zones.some((z) => z.kind === 'slow'), 'alpha rewind should drop a go zone')
}

{
  const m = createMatch('zuck', 'lecun', 'demo', 5)
  for (let i = 0; i < 500; i++) {
    stepMatch(m, [emptyPad(), emptyPad()])
    finite(m, 'demo')
  }
}

{
  const bad = ['finish him', 'fatality', 'scorpion', 'sub-zero', 'flawless victory']
  const blob = JSON.stringify(ROSTER).toLowerCase() + ' system halt token coliseum'
  for (const word of bad) assert(!blob.includes(word), `banned phrase present: ${word}`)
}

if (failures.length) {
  console.error(failures.join('\n'))
  throw new Error(`${failures.length} failed`)
}
console.log(`ok ${ROSTER.length} fighters, punch ${openDmg} vs chip ${chipDmg}`)
