/**
 * Web Audio API による効果音の自前生成。
 * 外部音源は一切使わず、オシレーターとノイズだけで合成する。
 * iOS Safari 対策として、最初のユーザー操作時に AudioContext を初期化する。
 */

let ctx: AudioContext | null = null
let muted = false
let bgmTimer: ReturnType<typeof setInterval> | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function setMuted(m: boolean): void {
  muted = m
  if (m) stopBonusBgm()
}

export function isMuted(): boolean {
  return muted
}

/** ユーザー操作を起点に AudioContext を確実に起こす */
export function unlockAudio(): void {
  getCtx()
}

function tone(freq: number, durationMs: number, opts: { type?: OscillatorType; gain?: number; delayMs?: number; slideTo?: number } = {}): void {
  if (muted) return
  const c = getCtx()
  if (!c) return
  const { type = 'square', gain = 0.08, delayMs = 0, slideTo } = opts
  const t0 = c.currentTime + delayMs / 1000
  const t1 = t0 + durationMs / 1000
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, t1)
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t1)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t1 + 0.05)
}

/** レバーON音 */
export function playLever(): void {
  tone(220, 80, { type: 'sawtooth', gain: 0.06 })
  tone(440, 60, { type: 'square', gain: 0.04, delayMs: 40 })
}

/** リール停止音 */
export function playStop(): void {
  tone(660, 50, { type: 'square', gain: 0.06 })
}

/** 小役入賞音 */
export function playWin(): void {
  tone(880, 90, { gain: 0.06 })
  tone(1320, 120, { gain: 0.06, delayMs: 90 })
}

/** リプレイ音 */
export function playReplay(): void {
  tone(523, 70, { gain: 0.05 })
  tone(523, 70, { gain: 0.05, delayMs: 100 })
}

/** 告知ランプ点灯音（ペコッと2音） */
export function playNotify(): void {
  tone(1047, 90, { type: 'sine', gain: 0.12 })
  tone(1568, 160, { type: 'sine', gain: 0.12, delayMs: 100 })
}

/** プレミアム告知音（上昇アルペジオ） */
export function playPremium(): void {
  const notes = [523, 659, 784, 1047, 1319, 1568]
  notes.forEach((f, i) => tone(f, 140, { type: 'sine', gain: 0.1, delayMs: i * 90 }))
}

/** ボーナス図柄が揃った時のファンファーレ */
export function playFanfare(): void {
  const seq: [number, number][] = [
    [784, 0], [784, 120], [784, 240], [1047, 380], [784, 600], [1047, 760],
  ]
  seq.forEach(([f, d]) => tone(f, 150, { type: 'square', gain: 0.09, delayMs: d }))
}

/** ボーナス中BGM風（簡易シーケンサー） */
export function startBonusBgm(): void {
  if (muted || bgmTimer) return
  const melody = [523, 659, 784, 659, 523, 659, 784, 1047]
  const bass = [131, 165, 196, 165]
  let step = 0
  bgmTimer = setInterval(() => {
    tone(melody[step % melody.length], 140, { type: 'square', gain: 0.045 })
    tone(bass[step % bass.length], 200, { type: 'triangle', gain: 0.07 })
    step++
  }, 180)
}

export function stopBonusBgm(): void {
  if (bgmTimer) {
    clearInterval(bgmTimer)
    bgmTimer = null
  }
}

/** コイン払い出し音 */
export function playPayout(): void {
  tone(1760, 40, { type: 'sine', gain: 0.05 })
  tone(2093, 60, { type: 'sine', gain: 0.05, delayMs: 50 })
}
