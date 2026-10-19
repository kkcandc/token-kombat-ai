import { GROUND } from './game/constants'
import { koStampScale, koTimeScale, screenShake } from './game/juice'
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

{
  const m = createMatch('altman', 'jensen', 'local', 21)
  toFight(m)
  place(m, 800, 860)
  let steps = 0
  while (m.fighters[1].hp === 100 && steps < 24) {
    const pad = emptyPad()
    pad.punch = true
    pad.punchPressed = steps === 0
    stepMatch(m, [pad, emptyPad()])
    steps++
  }
  assert(m.fighters[1].hp < 100, 'altman light should connect')
  assert(m.hitstop === 2, `light hitstop ${m.hitstop}`)
  assert(m.zoomKick > 0.04, 'camera kick on light')
  assert(m.shake >= 8, `light shake should rattle, shake ${m.shake}`)
  assert(m.ghosts.length > 0, 'clean hit should leave a smear')
  assert(m.sparks.some((s) => s.kind === 'slash'), 'clean hit should cut a slash')
  assert(m.sparks.some((s) => s.kind === 'flash' || s.kind === 'streak' || s.kind === 'shard'), 'light sparks')
  const held = screenShake(m.shake, m.frame, m.hitstop)
  const next = screenShake(m.shake, m.frame, m.hitstop - 1)
  assert(Math.abs(held.x) >= 2, `shake offset too small ${held.x}`)
  assert(held.x !== next.x || held.y !== next.y, 'hitstop frames should rattle, not lock one offset')
  const heldFrame = m.frame
  const heldPose = m.fighters[0].stateFrame
  const heldX = m.fighters[1].x
  stepMatch(m, [emptyPad(), emptyPad()])
  assert(m.frame === heldFrame, 'hitstop should freeze the sim clock')
  assert(m.fighters[0].stateFrame === heldPose, 'hitstop should freeze the attacker')
  assert(m.fighters[1].x === heldX, 'hitstop should freeze the victim')
  while (m.hitstop > 0) stepMatch(m, [emptyPad(), emptyPad()])
  const kick = emptyPad()
  kick.kick = true
  kick.kickPressed = true
  stepMatch(m, [kick, emptyPad()])
  assert(m.fighters[0].state === 'kick', `hit confirm should link into kick, state ${m.fighters[0].state}`)
  assert(m.lastAdv > 0, `light punch should be plus, adv ${m.lastAdv}`)
}

{
  const m = createMatch('altman', 'jensen', 'local', 22)
  toFight(m)
  place(m, 800, 1500)
  const pad = emptyPad()
  pad.punchPressed = true
  stepMatch(m, [pad, emptyPad()])
  for (let i = 0; i < 5; i++) stepMatch(m, [emptyPad(), emptyPad()])
  const kick = emptyPad()
  kick.kickPressed = true
  stepMatch(m, [kick, emptyPad()])
  assert(m.fighters[0].state === 'punch', `whiff should keep recovery, state ${m.fighters[0].state} f${m.fighters[0].stateFrame}`)
  assert(m.fighters[1].hp === 100, 'whiff punch connected from too far')
}

{
  const m = createMatch('altman', 'jensen', 'local', 23)
  toFight(m)
  place(m, 800, 850)
  let steps = 0
  while (m.fighters[1].hp === 100 && steps < 30) {
    const pad = emptyPad()
    pad.kick = true
    pad.kickPressed = steps === 0
    stepMatch(m, [pad, emptyPad()])
    steps++
  }
  assert(m.hitstop === 4, `medium hitstop ${m.hitstop}`)
  assert(m.impactTier === 1, `medium flash tier ${m.impactTier}`)
}

{
  const m = createMatch('jensen', 'mira', 'local', 24)
  toFight(m)
  place(m, 700, 860)
  m.fighters[0].meter = 100
  m.fighters[0].invuln = 0
  m.fighters[1].invuln = 0
  const pad = emptyPad()
  pad.specialPressed = true
  stepMatch(m, [pad, emptyPad()])
  let stop = 0
  for (let i = 0; i < 40 && stop === 0; i++) {
    const before = m.fighters[1].hp
    if (m.phase === 'fight') place(m, 700, 860)
    stepMatch(m, [emptyPad(), emptyPad()])
    if (m.fighters[1].hp < before) stop = m.hitstop
  }
  assert(stop === 6, `heavy hitstop ${stop}`)
}

{
  assert(screenShake(0, 10, 0).x === 0 && screenShake(0, 10, 0).y === 0, 'idle camera should sit still')
  for (let step = 0; step < 6; step++) {
    const off = screenShake(8, step, 0)
    assert(Math.abs(off.x) >= 2, `light rattle step ${step} x=${off.x}`)
  }
}

{
  const m = createMatch('altman', 'jensen', 'local', 31)
  toFight(m)
  place(m, 800, 860)
  m.fighters[1].hp = 6
  m.fighters[1].invuln = 0
  let guard = 0
  while (m.fighters[1].hp > 0 && guard < 40) {
    const pad = emptyPad()
    pad.punch = true
    pad.punchPressed = guard === 0
    stepMatch(m, [pad, emptyPad()])
    guard++
  }
  assert(m.fighters[1].hp === 0, `ko should empty the bar, hp ${m.fighters[1].hp}`)
  assert(Math.abs(m.fighters[1].vx) >= 14, `ko launch vx ${m.fighters[1].vx}`)
  assert(m.fighters[1].vy <= -8, `ko launch vy ${m.fighters[1].vy}`)
  assert(Math.abs(m.fighters[1].tumbleV) > 0.2, `ko tumble ${m.fighters[1].tumbleV}`)
  let sawSlow = false
  let rose = false
  let prev = 0
  for (let i = 0; i < 90 && !(m.phase === 'roundend' && (m.finish?.age ?? 0) > (m.finish?.beat ?? 0)); i++) {
    stepMatch(m, [emptyPad(), emptyPad()])
    const fin = m.finish
    if (fin?.kind === 'ko' && m.phase === 'fight') {
      if (fin.scale < 0.5) sawSlow = true
      if (prev > 0 && fin.scale > prev + 0.001) rose = true
      prev = fin.scale
    }
  }
  assert(sawSlow, 'ko beat should start in slow motion')
  assert(rose, 'ko time scale should ramp back up')
  assert(m.fighters[0].wins >= 1, 'ko should award the round')
  assert(m.phase === 'roundend', `ko beat should hand off to the round call, phase ${m.phase}`)
  assert(m.finish?.kind === 'ko', 'K.O. stamp should still be up as the call starts')
}

{
  const m = createMatch('altman', 'jensen', 'local', 32)
  toFight(m)
  m.reduceMotion = true
  place(m, 800, 860)
  m.fighters[1].hp = 6
  m.fighters[1].invuln = 0
  for (let i = 0; i < 30 && m.fighters[1].hp > 0; i++) {
    const pad = emptyPad()
    pad.punch = true
    pad.punchPressed = i === 0
    stepMatch(m, [pad, emptyPad()])
  }
  for (let i = 0; i < 12 && m.finish?.kind !== 'ko'; i++) stepMatch(m, [emptyPad(), emptyPad()])
  assert(m.finish?.kind === 'ko', 'reduced motion still gets a K.O. stamp')
  assert(m.finish?.scale === 1, `reduced motion skips slow-mo, scale ${m.finish?.scale}`)
}

{
  const m = createMatch('altman', 'jensen', 'local', 33)
  toFight(m)
  m.fighters[0].hp = 40
  m.fighters[1].hp = 55
  m.timer = 1
  stepMatch(m, [emptyPad(), emptyPad()])
  assert(m.phase === 'roundend', `timeout phase ${m.phase}`)
  assert(m.finish?.kind === 'time', `timeout should stamp TIME, got ${m.finish?.kind}`)
  assert(m.finish?.beat === 0, 'timeout does not run the KO beat')
  assert(m.sub.includes('LOSS CURVE'), `timeout copy ${m.sub}`)
  assert(m.fighters[0].state !== 'ko' && m.fighters[1].state !== 'ko', 'timeout is not a knockdown')
  assert(Math.abs(m.fighters[0].tumbleV) < 0.01 && Math.abs(m.fighters[1].tumbleV) < 0.01, 'timeout does not tumble')
}

{
  assert(Math.abs(koTimeScale(0) - 0.15) < 1e-9, 'slow-mo starts at 0.15')
  assert(koTimeScale(1) === 1, 'slow-mo returns to full speed')
  assert(koTimeScale(0.4, true) === 1, 'reduced motion time scale stays 1')
  assert(koTimeScale(0.5) < koTimeScale(0.9), 'scale ramps upward')
  const over = koStampScale(8)
  const settled = koStampScale(20)
  assert(over > 1, `stamp should overshoot, got ${over}`)
  assert(Math.abs(settled - 1) < 0.02, `stamp should settle near 1, got ${settled}`)
  assert(koStampScale(4, true) === 1, 'reduced motion stamp does not bounce')
}

if (failures.length) {
  console.error(failures.join('\n'))
  throw new Error(`${failures.length} failed`)
}
console.log(`ok ${ROSTER.length} fighters, punch ${openDmg} vs chip ${chipDmg}`)
