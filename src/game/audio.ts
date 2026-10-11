type Kind = OscillatorType

export class ArcadeAudio {
  private ctx: AudioContext | null = null
  private noise: AudioBuffer | null = null
  muted = false
  music = true
  private nextNote = 0
  private vary = 0
  private lastMusicFrame = -1

  unlock() {
    const ctx = this.ensure()
    if (ctx.state === 'suspended') void ctx.resume()
  }

  toggleMute() {
    this.muted = !this.muted
    return this.muted
  }

  toggleMusic() {
    this.music = !this.music
    return this.music
  }

  play(name: string) {
    if (this.muted) return
    const ctx = this.ensure()
    if (ctx.state !== 'running') return
    if (name === 'punch' || name === 'kick' || name === 'whoosh') this.whoosh()
    else if (name === 'special') {
      this.whoosh()
      this.toneAt(420, 0.12, 'square', 0.045, 0)
      this.toneAt(640, 0.16, 'triangle', 0.04, 0.04)
    } else if (name === 'hit' || name === 'hit-light') this.impact(0)
    else if (name === 'hit-mid') this.impact(1)
    else if (name === 'hit-heavy') this.impact(2)
    else if (name === 'block') this.guard()
    else if (name === 'ko') this.koStinger()
    else if (name === 'round') this.roundStinger()
    else if (name === 'land') this.toneAt(90, 0.04, 'square', 0.03, 0)
    else if (name === 'ui') this.toneAt(660, 0.05, 'square', 0.03, 0)
  }

  tickMusic(frame: number) {
    if (this.muted || !this.music) return
    if (frame === this.lastMusicFrame) return
    this.lastMusicFrame = frame
    const ctx = this.ensure()
    if (ctx.state !== 'running') return
    if (frame % 30 !== 0) return
    const scale = [110, 130.8, 164.8, 196, 220]
    const note = scale[(frame / 30) % scale.length]
    if (ctx.currentTime < this.nextNote - 0.02) return
    this.tone(note, 0.18, 'triangle', 0.018)
    if (frame % 60 === 0) this.tone(55, 0.12, 'sine', 0.03)
    this.nextNote = ctx.currentTime + 0.12
  }

  private ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AC()
      const len = this.ctx.sampleRate * 0.2
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const data = this.noise.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
    }
    return this.ctx
  }

  private tone(freq: number, dur: number, type: Kind, gain: number) {
    this.toneAt(freq, dur, type, gain, 0)
  }

  private toneAt(freq: number, dur: number, type: Kind, gain: number, when: number, endFreq?: number) {
    const ctx = this.ensure()
    const t0 = ctx.currentTime + when
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(Math.max(1, freq), t0)
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + dur)
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g)
    g.connect(ctx.destination)
    o.start(t0)
    o.stop(t0 + dur + 0.02)
  }

  private noiseHit(dur: number, gain: number, cutoff: number, when = 0) {
    const ctx = this.ensure()
    if (!this.noise) return
    const t0 = ctx.currentTime + when
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const g = ctx.createGain()
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(cutoff, t0)
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(f)
    f.connect(g)
    g.connect(ctx.destination)
    src.start(t0)
    src.stop(t0 + dur + 0.02)
  }

  private whoosh() {
    const v = this.vary++ % 3
    const start = [1500, 980, 1860][v]
    const end = [260, 170, 340][v]
    const ctx = this.ensure()
    if (!this.noise) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 0.85
    f.frequency.setValueAtTime(start, ctx.currentTime)
    f.frequency.exponentialRampToValueAtTime(end, ctx.currentTime + 0.12)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.018)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14)
    src.connect(f)
    f.connect(g)
    g.connect(ctx.destination)
    src.start()
    src.stop(ctx.currentTime + 0.16)
    this.toneAt([540, 390, 680][v], 0.09, 'sine', 0.028, 0, [210, 150, 260][v])
  }

  private impact(tier: 0 | 1 | 2) {
    const body = [168, 102, 62][tier]
    this.toneAt(body, [0.09, 0.13, 0.2][tier], 'sine', [0.18, 0.24, 0.32][tier], 0, body * 0.45)
    this.noiseHit([0.06, 0.1, 0.16][tier], [0.1, 0.15, 0.2][tier], [1700, 980, 460][tier])
    this.bark()
  }

  private bark() {
    const v = this.vary++ % 3
    const low = [300, 210, 360][v]
    const high = [640, 490, 820][v]
    this.toneAt(low, 0.08, 'triangle', 0.055, 0.008, low * 0.72)
    this.toneAt(high, 0.05, 'square', 0.018, 0.01, high * 0.8)
  }

  private guard() {
    this.toneAt(920, 0.05, 'square', 0.04, 0, 420)
    this.toneAt(210, 0.08, 'triangle', 0.05, 0)
    this.noiseHit(0.045, 0.05, 2600)
  }

  private roundStinger() {
    this.noiseHit(0.04, 0.05, 2200)
    this.toneAt(523.25, 0.1, 'triangle', 0.06, 0)
    this.toneAt(659.25, 0.11, 'triangle', 0.06, 0.08)
    this.toneAt(783.99, 0.24, 'triangle', 0.07, 0.16)
    this.toneAt(1568, 0.14, 'sine', 0.03, 0.16)
  }

  private koStinger() {
    this.noiseHit(0.24, 0.18, 640)
    this.toneAt(110, 0.16, 'sawtooth', 0.07, 0, 52)
    this.toneAt(73, 0.48, 'sine', 0.11, 0.04, 34)
    this.toneAt(196, 0.18, 'triangle', 0.05, 0.2, 92)
    this.toneAt(49, 0.55, 'sine', 0.08, 0.26)
  }
}
