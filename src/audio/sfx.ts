/**
 * Web Audio API による効果音の自前合成。
 *
 * 実機ジャグラーの音の構成を調査し、その特徴（音色・音程・リズム）を
 * オシレーターとノイズだけで忠実に再現している：
 * - ベットは電子音「ピッ」×枚数、レバー・停止は機械音のみ
 * - 小役にメロディはなく、払い出しメダルの「ピロピロ」が枚数分鳴るだけ
 * - GOGOランプは無音で点灯、プレミアム時のみ「ガコッ」
 * - BIGはブラス風ファンファーレ→マーチ調BGM、REGは簡素なループ
 * （実機音源データは権利物のため使用せず、すべて合成で再現）
 *
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

/** ホワイトノイズ（機械音・打撃音に使う） */
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

/** ブラス風の和音スタブ（ファンファーレ用：ノコギリ波を重ねる） */
function brassChord(freqs: number[], durationMs: number, delayMs: number, gain = 0.055): void {
  for (const f of freqs) {
    tone(f, durationMs, { type: 'sawtooth', gain, delayMs, attackMs: 8 })
    tone(f * 2, durationMs, { type: 'square', gain: gain * 0.3, delayMs, attackMs: 8 })
  }
}

// ---------------------------------------------------------------------------
// 操作音（実機は機械音＋電子ビープのみ）
// ---------------------------------------------------------------------------

/** メダル投入音：電子音「ピッ」×枚数（実機のベット音） */
export function playBet(count = 3): void {
  const n = Math.max(1, Math.min(3, count))
  for (let i = 0; i < n; i++) {
    tone(1245, 45, { type: 'square', gain: 0.07, delayMs: i * 78 })
  }
}

/** レバーON音：「ガチャッ」という機械音（実機に電子音はない） */
export function playLever(): void {
  noise(55, { filter: 'lowpass', freq: 500, gain: 0.2 })
  tone(120, 70, { type: 'sine', gain: 0.16, slideTo: 62 })
  noise(30, { filter: 'bandpass', freq: 2100, q: 5, gain: 0.07, delayMs: 14 })
  noise(24, { filter: 'bandpass', freq: 1300, q: 4, gain: 0.05, delayMs: 34 })
}

/** リール始動音：モーターの静かな立ち上がり */
export function playReelStart(): void {
  tone(110, 200, { type: 'triangle', gain: 0.028, slideTo: 240 })
  noise(160, { filter: 'lowpass', freq: 420, gain: 0.014, slideTo: 800 })
}

/** リール停止音：ボタンの「パチッ」＋リールの「スタッ」（機械音のみ） */
export function playStop(): void {
  noise(14, { filter: 'highpass', freq: 3200, gain: 0.09 })
  tone(150, 45, { type: 'sine', gain: 0.11, slideTo: 95, delayMs: 8 })
  noise(26, { filter: 'lowpass', freq: 600, gain: 0.07, delayMs: 8 })
}

// ---------------------------------------------------------------------------
// 払い出し・小役（実機はメロディなし＝メダルの「ピロピロ」だけ）
// ---------------------------------------------------------------------------

/**
 * 払い出し音：メダル1枚ごとの電子音「ピロッ」を枚数分連打する。
 * ぶどう=8枚・チェリー=2枚・ボーナス中=15枚などすべてこの音で表現される
 * （実機の小役に固有のメロディはない）。
 */
export function playPayout(count = 4): void {
  const n = Math.max(1, Math.min(15, count))
  for (let i = 0; i < n; i++) {
    const d = i * 52
    // 2音で「ピロッ」：高→低のごく短い下降
    tone(i % 2 === 0 ? 1975 : 1760, 26, { type: 'square', gain: 0.055, delayMs: d })
    tone(i % 2 === 0 ? 1480 : 1319, 26, { type: 'square', gain: 0.05, delayMs: d + 26 })
  }
}

/** リプレイ音：「ピコッ」＋自動ベットの「ピピピッ」 */
export function playReplay(): void {
  tone(1568, 55, { type: 'square', gain: 0.06 })
  tone(1046, 70, { type: 'square', gain: 0.06, delayMs: 60 })
  // 自動ベット3枚分
  for (let i = 0; i < 3; i++) {
    tone(1245, 40, { type: 'square', gain: 0.05, delayMs: 220 + i * 70 })
  }
}

// ---------------------------------------------------------------------------
// 告知・ボーナス
// ---------------------------------------------------------------------------

/**
 * 告知ランプ点灯音。
 * 実機のGOGOランプは無音で点灯する（静かに光るのが「ペカ」）ため、
 * 実機準拠であえて何も鳴らさない。
 */
export function playNotify(): void {
  // 実機準拠：無音
}

/** プレミアム告知「ガコッ」（実機のプレミア音を再現した金属衝撃音） */
export function playPremium(): void {
  noise(90, { filter: 'lowpass', freq: 260, gain: 0.5 })
  tone(82, 130, { type: 'square', gain: 0.26, slideTo: 46 })
  noise(45, { filter: 'bandpass', freq: 1100, q: 3, gain: 0.16, delayMs: 6 })
  tone(190, 60, { type: 'sine', gain: 0.2, slideTo: 90, delayMs: 4 })
}

/**
 * ボーナス揃い時のファンファーレ。
 * BIG: ドラムロール→ブラスの3連打→上昇して大団円（実機の高揚感を再現）
 * REG: 短めのジングル
 */
export function playFanfare(kind: 'BIG' | 'REG' = 'BIG'): void {
  if (kind === 'REG') {
    brassChord([523, 659, 784], 140, 0, 0.06)
    brassChord([587, 740, 880], 140, 160, 0.06)
    brassChord([659, 830, 988], 320, 320, 0.07)
    noise(70, { filter: 'bandpass', freq: 240, q: 1, gain: 0.06, delayMs: 320 })
    return
  }
  // ドラムロール
  for (let i = 0; i < 10; i++) {
    noise(28, { filter: 'bandpass', freq: 220, q: 1, gain: 0.028 + i * 0.004, delayMs: i * 32 })
  }
  // ブラス3連打 → サブドミナント → ドミナント → トニックで解決
  brassChord([262, 330, 392], 110, 340)
  brassChord([262, 330, 392], 110, 480)
  brassChord([262, 330, 392], 110, 620)
  brassChord([349, 440, 523], 240, 780)
  brassChord([392, 494, 587], 240, 1050)
  brassChord([523, 659, 784], 620, 1320, 0.065)
  tone(1046, 620, { type: 'square', gain: 0.05, delayMs: 1320, attackMs: 10 })
  noise(90, { filter: 'bandpass', freq: 260, q: 1, gain: 0.08, delayMs: 780 })
  noise(90, { filter: 'bandpass', freq: 260, q: 1, gain: 0.08, delayMs: 1050 })
  noise(120, { filter: 'bandpass', freq: 280, q: 1, gain: 0.1, delayMs: 1320 })
  noise(500, { filter: 'highpass', freq: 6000, gain: 0.03, delayMs: 1340 })
}

/**
 * ボーナス中BGM。
 * BIG: 行進曲調のループ（実機のマーチの雰囲気を再現したオリジナル）
 * REG: 簡素で軽快な短いループ
 */
export function startBonusBgm(kind: 'BIG' | 'REG' = 'BIG'): void {
  if (muted || bgmTimer) return

  if (kind === 'REG') {
    const melody = [1046, 0, 1318, 0, 1568, 0, 1318, 0]
    const bassR = [262, 196, 220, 196]
    let step = 0
    bgmTimer = setInterval(() => {
      const m = melody[step % melody.length]
      if (m > 0) tone(m, 110, { type: 'square', gain: 0.032 })
      tone(bassR[(step >> 1) % bassR.length], 140, { type: 'triangle', gain: 0.06 })
      noise(16, { filter: 'highpass', freq: 7000, gain: 0.014 })
      step++
    }, 170)
    return
  }

  // BIG: 2小節のマーチ（ズンチャッ・ズンチャッの上に笛のメロディ）
  const melody = [
    784, 0, 784, 659, 784, 0, 1046, 0,
    880, 0, 880, 784, 880, 0, 1175, 0,
    1046, 0, 988, 0, 880, 0, 784, 659,
    784, 880, 784, 659, 523, 0, 0, 0,
  ]
  const bass = [262, 392, 262, 392, 349, 523, 392, 494, 262, 392, 262, 392, 349, 440, 392, 262]
  let step = 0
  bgmTimer = setInterval(() => {
    const m = melody[step % melody.length]
    if (m > 0) {
      tone(m, 115, { type: 'square', gain: 0.036 })
      tone(m / 2, 115, { type: 'triangle', gain: 0.022 })
    }
    // ズン（低音）チャッ（スネア）
    tone(bass[(step >> 1) % bass.length] / 2, 130, { type: 'triangle', gain: 0.07 })
    if (step % 2 === 1) noise(30, { filter: 'bandpass', freq: 3000, q: 0.8, gain: 0.02 })
    if (step % 8 === 6) noise(45, { filter: 'bandpass', freq: 240, q: 1, gain: 0.045 })
    step++
  }, 130)
}

export function stopBonusBgm(): void {
  if (bgmTimer) {
    clearInterval(bgmTimer)
    bgmTimer = null
  }
}

/** ボーナス終了音：下降ジングル「テレレン」 */
export function playBonusEnd(): void {
  tone(1046, 110, { type: 'square', gain: 0.06 })
  tone(784, 110, { type: 'square', gain: 0.06, delayMs: 120 })
  tone(659, 110, { type: 'square', gain: 0.06, delayMs: 240 })
  brassChord([523, 659, 784], 420, 380, 0.05)
}
