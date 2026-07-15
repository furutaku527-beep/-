/**
 * Web Audio API によるクリック音の自前合成（外部音源なし）。
 * 実機カウンターの「カチッ」という打鍵感を短いノイズ＋低音で再現する。
 * iOS Safari 対策として、最初のユーザー操作時に AudioContext を初期化する。
 */

let ctx: AudioContext | null = null
let noiseBuf: AudioBuffer | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function unlockAudio(): void {
  getCtx()
}

function noise(c: AudioContext, durationMs: number, freq: number, gain: number, delayMs = 0): void {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate / 4, c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const t0 = c.currentTime + delayMs / 1000
  const t1 = t0 + durationMs / 1000
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = freq
  f.Q.value = 1.2
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.003)
  g.gain.exponentialRampToValueAtTime(0.001, t1)
  src.connect(f).connect(g).connect(c.destination)
  src.start(t0)
  src.stop(t1 + 0.05)
}

function tone(c: AudioContext, freq: number, durationMs: number, gain: number, slideTo?: number): void {
  const t0 = c.currentTime
  const t1 = t0 + durationMs / 1000
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, t1)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.003)
  g.gain.exponentialRampToValueAtTime(0.001, t1)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t1 + 0.05)
}

/** カウント音：「カチッ」 */
export function playClick(): void {
  const c = getCtx()
  if (!c) return
  noise(c, 16, 3400, 0.14)
  tone(c, 190, 40, 0.12, 120)
}

/** 減算音：低めの「コッ」 */
export function playMinus(): void {
  const c = getCtx()
  if (!c) return
  tone(c, 130, 60, 0.12, 80)
}

/** リセット音：「チリッ」という下降 */
export function playReset(): void {
  const c = getCtx()
  if (!c) return
  tone(c, 880, 70, 0.07, 440)
  noise(c, 30, 2400, 0.05, 20)
}
