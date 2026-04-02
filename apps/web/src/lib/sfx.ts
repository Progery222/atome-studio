/**
 * Procedural sound effects via Web Audio API.
 * No audio files — everything synthesized.
 */

let ac: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ac) ac = new AudioContext()
  if (ac.state === 'suspended') ac.resume()
  return ac
}

/** Soft "click" tone — played when selecting a planet */
export function sfxSelect() {
  const ctx = getCtx()
  const now = ctx.currentTime

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(880, now)
  osc.frequency.exponentialRampToValueAtTime(440, now + 0.15)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.08, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 2000

  osc.connect(filter).connect(gain).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.35)
}

/** Soft "whoosh" — played when camera flies to planet */
export function sfxWhoosh() {
  const ctx = getCtx()
  const now = ctx.currentTime

  // Filtered noise sweep
  const len = ctx.sampleRate * 1.2
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.5
  }

  const noise = ctx.createBufferSource()
  noise.buffer = buf

  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(200, now)
  bp.frequency.exponentialRampToValueAtTime(1500, now + 0.4)
  bp.frequency.exponentialRampToValueAtTime(300, now + 1.0)
  bp.Q.value = 1.5

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.06, now + 0.15)
  gain.gain.linearRampToValueAtTime(0.03, now + 0.5)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1)

  noise.connect(bp).connect(gain).connect(ctx.destination)
  noise.start(now)
  noise.stop(now + 1.2)

  // Sub-bass thump
  const sub = ctx.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(80, now)
  sub.frequency.exponentialRampToValueAtTime(40, now + 0.4)

  const subGain = ctx.createGain()
  subGain.gain.setValueAtTime(0.05, now)
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

  sub.connect(subGain).connect(ctx.destination)
  sub.start(now)
  sub.stop(now + 0.55)
}

/** Gentle "deselect" — when closing/unfocusing */
export function sfxDeselect() {
  const ctx = getCtx()
  const now = ctx.currentTime

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(440, now)
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.2)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.05, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

  osc.connect(gain).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.3)
}
