/**
 * カチカチくんのコアロジック（UI非依存の純関数）。
 *
 * 実機「勝ち勝ちくん」の機能をそのまま踏襲する：
 * - 4色（白・赤・緑・黄）の独立カウンター
 * - 総回転数の入力と「総回転数 ÷ カウント数」による確率算出
 * - 複数役の合算確率
 * - 個別リセット / シーンリセット
 * - A/B/Cの3シーン独立カウント
 *
 * 実機の「長押しリセット」「÷モード切替」などはボタン数の制約による
 * 操作系なので、アプリでは専用ボタン・常時同時表示に置き換える。
 */

export type ColorKey = 'white' | 'red' | 'green' | 'yellow'
export type SceneId = 'A' | 'B' | 'C'

export const COLOR_KEYS: readonly ColorKey[] = ['white', 'red', 'green', 'yellow']
export const SCENE_IDS: readonly SceneId[] = ['A', 'B', 'C']

/** カウント・回転数の上限（実機の表示桁準拠で6桁） */
export const MAX_VALUE = 999999

export interface CounterCell {
  /** ボタンに割り当てた役名（自由に変更可能） */
  label: string
  count: number
}

/** ボーナス関連のカウント（設定推測に使う） */
export interface BonusData {
  big: number
  reg: number
  /** BIG中に成立したスイカの回数 */
  bigSuika: number
}

/** 示唆ランプの色 */
export type LampColor = 'blue' | 'green' | 'yellow' | 'red' | 'rainbow'
/** 示唆の種類: REG中サイドランプ / BIG終了時トップランプ / REG終了時トップランプ */
export type HintGroup = 'side' | 'endBig' | 'endReg'

export const LAMP_COLORS: readonly LampColor[] = ['blue', 'green', 'yellow', 'red', 'rainbow']
export const HINT_GROUPS: readonly HintGroup[] = ['side', 'endBig', 'endReg']

export type HintData = Record<HintGroup, Record<LampColor, number>>

export interface SceneData {
  /** 総回転数（ゲーム数） */
  games: number
  cells: Record<ColorKey, CounterCell>
  bonus: BonusData
  hints: HintData
}

/** ハナハナ用のデフォルト割り当て（役名は自由に変更可能） */
export const DEFAULT_LABELS: Record<ColorKey, string> = {
  white: 'ベル',
  red: 'スイカ',
  green: 'チェリー',
  yellow: 'その他',
}

function createLampCounts(): Record<LampColor, number> {
  return { blue: 0, green: 0, yellow: 0, red: 0, rainbow: 0 }
}

export function createBonus(): BonusData {
  return { big: 0, reg: 0, bigSuika: 0 }
}

export function createHints(): HintData {
  return { side: createLampCounts(), endBig: createLampCounts(), endReg: createLampCounts() }
}

export function createScene(): SceneData {
  return {
    games: 0,
    cells: {
      white: { label: DEFAULT_LABELS.white, count: 0 },
      red: { label: DEFAULT_LABELS.red, count: 0 },
      green: { label: DEFAULT_LABELS.green, count: 0 },
      yellow: { label: DEFAULT_LABELS.yellow, count: 0 },
    },
    bonus: createBonus(),
    hints: createHints(),
  }
}

export function createAllScenes(): Record<SceneId, SceneData> {
  return { A: createScene(), B: createScene(), C: createScene() }
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(MAX_VALUE, Math.max(0, Math.floor(n)))
}

function withCell(scene: SceneData, key: ColorKey, cell: CounterCell): SceneData {
  return { ...scene, cells: { ...scene.cells, [key]: cell } }
}

/** カウント +1 */
export function increment(scene: SceneData, key: ColorKey): SceneData {
  const cell = scene.cells[key]
  return withCell(scene, key, { ...cell, count: clamp(cell.count + 1) })
}

/** カウント −1（ミス修正。0未満にはならない） */
export function decrement(scene: SceneData, key: ColorKey): SceneData {
  const cell = scene.cells[key]
  return withCell(scene, key, { ...cell, count: clamp(cell.count - 1) })
}

/** 個別カウンターを0に（実機の「ボタン長押しリセット」相当） */
export function resetCell(scene: SceneData, key: ColorKey): SceneData {
  const cell = scene.cells[key]
  return withCell(scene, key, { ...cell, count: 0 })
}

/** 役名ラベルの変更 */
export function setLabel(scene: SceneData, key: ColorKey, label: string): SceneData {
  const cell = scene.cells[key]
  return withCell(scene, key, { ...cell, label: label.slice(0, 10) })
}

/** 総回転数を直接セット */
export function setGames(scene: SceneData, games: number): SceneData {
  return { ...scene, games: clamp(games) }
}

/** 総回転数の増減（+1/+10/+100/+1000 と −側） */
export function addGames(scene: SceneData, delta: number): SceneData {
  return { ...scene, games: clamp(scene.games + delta) }
}

/** ボーナスカウントの増減 */
export function addBonus(scene: SceneData, key: keyof BonusData, delta: number): SceneData {
  return { ...scene, bonus: { ...scene.bonus, [key]: clamp(scene.bonus[key] + delta) } }
}

/** 示唆ランプ記録の増減 */
export function addHint(
  scene: SceneData,
  group: HintGroup,
  color: LampColor,
  delta: number,
): SceneData {
  return {
    ...scene,
    hints: {
      ...scene.hints,
      [group]: { ...scene.hints[group], [color]: clamp(scene.hints[group][color] + delta) },
    },
  }
}

/** シーン全体をリセット（ラベルは保持） */
export function resetScene(scene: SceneData): SceneData {
  return {
    games: 0,
    cells: {
      white: { ...scene.cells.white, count: 0 },
      red: { ...scene.cells.red, count: 0 },
      green: { ...scene.cells.green, count: 0 },
      yellow: { ...scene.cells.yellow, count: 0 },
    },
    bonus: createBonus(),
    hints: createHints(),
  }
}

/**
 * 確率の分母を返す（総回転数 ÷ カウント数）。
 * 実機と同じく、算出できないとき（G数0またはカウント0）は null。
 */
export function denominator(games: number, count: number): number | null {
  if (games <= 0 || count <= 0) return null
  return games / count
}

/** 合算確率の分母（実機の「紫→色ボタン2つ」の合算計算。3つ以上にも対応） */
export function combinedDenominator(games: number, counts: number[]): number | null {
  const total = counts.reduce((a, b) => a + b, 0)
  return denominator(games, total)
}

/** 「1/6.0」形式の表示文字列。算出不能時は「1/--.-」 */
export function formatRatio(d: number | null): string {
  if (d === null) return '1/--.-'
  if (d >= 10000) return `1/${Math.round(d)}`
  return `1/${d.toFixed(1)}`
}
