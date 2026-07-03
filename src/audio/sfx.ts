/**
 * Web Audio API による効果音の自前生成。
 * 外部音源は一切使わず、オシレーターとノイズだけで合成する。
 * マスターにコンプレッサーを挟んで音圧感を出す。
 * iOS Safari 対策として、最初のユーザー操作時に AudioContext を初期化する。
 */

let ctx: AudioContext | null = null
let master: DynamicsCompressorNode | null = null
let muted = false
let bgmTimer: ReturnType<typeof setInterval> | null = null
let noiseBuf: AudioBuffer | null = null

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

function bus(c: AudioContext): DynamicsCompressorNode {
  if (!master) {
    master = c.createDynamicsCompressor()
    master.threshold.value = -16
    master.knee.value = 22
    master.ratio.value = 7
    master.attack.value = 0.002
    master.release.value = 0.12
    master.connect(c.destination)
  }
  return master
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

interface ToneOpts {
  type?: OscillatorType
  gain?: number
  delayMs?: number
  slideTo?: number
  attackMs?: number
}

function tone(freq: number, durationMs: number, opts: ToneOpts = {}): void {
  if (muted) return
  const c = getCtx()
  if (!c) return
  const { type = 'square', gain = 0.08, delayMs = 0, slideTo, attackMs = 3 } = opts
  const t0 = c.currentTime + delayMs / 1000
  const tA = t0 + attackMs / 1000
  const t1 = t0 + durationMs / 1000
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, t1)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(gain, tA)
  g.gain.exponentialRampToValueAtTime(0.001, t1)
  osc.connect(g).connect(bus(c))
  osc.start(t0)
  osc.stop(t1 + 0.05)
}

interface NoiseOpts {
  gain?: number
  delayMs?: number
  filter?: BiquadFilterType
  freq?: number
  q?: number
  slideTo?: number
}

/** ホワイトノイズ（打撃・メカ音・シャリ感に使う） */
function noise(durationMs: number, opts: NoiseOpts = {}): void {
  if (muted) return
  const c = getCtx()
  if (!c) return
  const { gain = 0.08, delayMs = 0, filter = 'bandpass', freq = 1000, q = 1, slideTo } = opts
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const t0 = c.currentTime + delayMs / 1000
  const t1 = t0 + durationMs / 1000
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const f = c.createBiquadFilter()
  f.type = filter
  f.frequency.setValueAtTime(freq, t0)
  if (slideTo) f.frequency.linearRampToValueAtTime(slideTo, t1)
  f.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.004)
  g.gain.exponentialRampToValueAtTime(0.001, t1)
  src.connect(f).connect(g).connect(bus(c))
  src.start(t0)
  src.stop(t1 + 0.05)
}

/** メダル投入音（3枚分の金属クリック） */
export function playBet(): void {
  for (let i = 0; i < 3; i++) {
    noise(18, { filter: 'highpass', freq: 5000, gain: 0.05, delayMs: i * 65 })
    tone(2300 + i * 180, 25, { type: 'sine', gain: 0.05, delayMs: i * 65 })
  }
}

/** レバーON音（ガコッという打撃＋金属の余韻） */
export function playLever(): void {
  noise(60, { filter: 'lowpass', freq: 420, gain: 0.16 })
  tone(95, 90, { type: 'sine', gain: 0.15, slideTo: 55 })
  noise(35, { filter: 'bandpass', freq: 1600, q: 6, gain: 0.05, delayMs: 12 })
}

/** リール始動音（モーターの立ち上がり） */
export function playReelStart(): void {
  tone(130, 160, { type: 'sawtooth', gain: 0.04, slideTo: 300 })
  noise(120, { filter: 'bandpass', freq: 500, q: 2, gain: 0.02, slideTo: 900 })
}

/** リール停止音（バチッという打撃） */
export function playStop(): void {
  tone(190, 55, { type: 'sine', gain: 0.12, slideTo: 130 })
  noise(16, { filter: 'highpass', freq: 2500, gain: 0.07 })
}

/** ぶどう入賞音 */
export function playWin(): void {
  tone(740, 70, { type: 'square', gain: 0.07 })
  tone(988, 110, { type: 'square', gain: 0.07, delayMs: 70 })
}

/** チェリー入賞音 */
export function playCherry(): void {
  tone(660, 50, { type: 'square', gain: 0.06 })
  tone(880, 80, { type: 'square', gain: 0.06, delayMs: 55 })
}

/** ベル入賞音 */
export function playBell(): void {
  tone(1319, 120, { type: 'triangle', gain: 0.1 })
  tone(1760, 200, { type: 'triangle', gain: 0.08, delayMs: 90 })
  noise(160, { filter: 'highpass', freq: 6000, gain: 0.03, delayMs: 90 })
}

/** ピエロ入賞音 */
export function playClown(): void {
  const seq = [660, 880, 660, 1047]
  seq.forEach((f, i) => tone(f, 70, { type: 'square', gain: 0.07, delayMs: i * 75 }))
}

/** リプレイ音 */
export function playReplay(): void {
  tone(523, 65, { type: 'square', gain: 0.05 })
  tone(523, 65, { type: 'square', gain: 0.05, delayMs: 95 })
}

/** 告知ランプ点灯音（「ペカッ」＋和音の余韻） */
export function playNotify(): void {
  tone(1047, 130, { type: 'sine', gain: 0.14, slideTo: 2093 })
  tone(2637, 70, { type: 'sine', gain: 0.08, delayMs: 115 })
  tone(523, 380, { type: 'triangle', gain: 0.05, delayMs: 40 })
  tone(659, 380, { type: 'triangle', gain: 0.05, delayMs: 40 })
  tone(784, 380, { type: 'triangle', gain: 0.05, delayMs: 40 })
}

/** プレミアム告知音（キュイーン系の上昇） */
export function playPremium(): void {
  tone(523, 650, { type: 'sawtooth', gain: 0.06, slideTo: 2093 })
  const notes = [659, 784, 1047, 1319, 1568, 2093]
  notes.forEach((f, i) => tone(f, 130, { type: 'sine', gain: 0.09, delayMs: 120 + i * 85 }))
  noise(600, { filter: 'highpass', freq: 5000, gain: 0.025, delayMs: 150 })
}

/** ボーナス図柄が揃った時のファンファーレ */
export function playFanfare(): void {
  const lead: [number, number, number][] = [
    // [freq, delay, dur]
    [784, 0, 110],
    [784, 130, 110],
    [784, 260, 110],
    [1047, 400, 380],
    [880, 850, 130],
    [988, 1000, 130],
    [1319, 1150, 520],
  ]
  lead.forEach(([f, d, dur]) => tone(f, dur, { type: 'square', gain: 0.09, delayMs: d }))
  const bass: [number, number][] = [
    [131, 0],
    [196, 400],
    [165, 850],
    [131, 1150],
  ]
  bass.forEach(([f, d]) => tone(f, 320, { type: 'triangle', gain: 0.1, delayMs: d }))
  ;[0, 400, 850, 1150].forEach((d) => noise(70, { filter: 'bandpass', freq: 250, q: 1, gain: 0.06, delayMs: d }))
}

/** ボーナス中BGM（マーチ風の簡易シーケンサー） */
export function startBonusBgm(): void {
  if (muted || bgmTimer) return
  const melody = [1047, 0, 1319, 0, 1568, 1319, 1047, 1319, 1175, 0, 1319, 0, 1047, 880, 784, 880]
  const bass = [262, 262, 196, 196, 220, 220, 175, 196]
  let step = 0
  bgmTimer = setInterval(() => {
    const m = melody[step % melody.length]
    if (m > 0) tone(m, 120, { type: 'square', gain: 0.035 })
    tone(bass[(step >> 1) % bass.length], 160, { type: 'triangle', gain: 0.07 })
    noise(18, { filter: 'highpass', freq: 7000, gain: step % 4 === 2 ? 0.03 : 0.015 })
    step++
  }, 150)
}

export function stopBonusBgm(): void {
  if (bgmTimer) {
    clearInterval(bgmTimer)
    bgmTimer = null
  }
}

/** コイン払い出し音（枚数に応じて連打） */
export function playPayout(count = 4): void {
  const n = Math.min(8, Math.max(2, Math.round(count / 2)))
  for (let i = 0; i < n; i++) {
    tone(1800 + (i % 3) * 220, 26, { type: 'sine', gain: 0.045, delayMs: i * 48 })
    noise(14, { filter: 'highpass', freq: 5500, gain: 0.035, delayMs: i * 48 + 4 })
  }
}
