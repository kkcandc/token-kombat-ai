type Kind = OscillatorType

export class ArcadeAudio {
  private ctx: AudioContext | null = null
  private noise: AudioBuffer | null = null
  muted = false
  music = true
  private nextNote = 0

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
    if (name === 'punch') this.tone(180, 0.06, 'square', 0.05)
    else if (name === 'kick') this.tone(120, 0.09, 'sawtooth', 0.05)
    else if (name === 'special') {
      this.tone(420, 0.12, 'square', 0.04)
      this.tone(640, 0.16, 'triangle', 0.04)
    } else if (name === 'hit') this.burst(0.08, 0.12)
    else if (name === 'block') this.tone(240, 0.05, 'square', 0.03)
    else if (name === 'ko') {
      this.tone(90, 0.35, 'sawtooth', 0.07)
      this.tone(50, 0.45, 'triangle', 0.06)
    } else if (name === 'round') this.tone(520, 0.14, 'triangle', 0.05)
    else if (name === 'land') this.tone(90, 0.04, 'square', 0.02)
    else if (name === 'ui') this.tone(660, 0.05, 'square', 0.03)
  }

  tickMusic(frame: number) {
    if (this.muted || !this.music) return
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
    const ctx = this.ensure()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = freq
    g.gain.setValueAtTime(gain, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + dur)
  }

  private burst(dur: number, gain: number) {
    const ctx = this.ensure()
    if (!this.noise) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const g = ctx.createGain()
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 900
    g.gain.setValueAtTime(gain, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
    src.connect(f)
    f.connect(g)
    g.connect(ctx.destination)
    src.start()
    src.stop(ctx.currentTime + dur)
  }
}
