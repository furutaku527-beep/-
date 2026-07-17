/**
 * ハナハナシリーズの機種スペック定義（データ駆動）。
 *
 * 新機種を追加するときは、このファイルに MachineSpec を1つ追加して
 * MACHINES に登録するだけでよい。推測ロジック（estimate.ts）とUIは
 * ここのデータを読むだけなので、コードの変更は不要。
 *
 * ボーナス確率は各機種の公表値ベース。ベル・BIG中スイカ・示唆ランプの
 * 振り分けは解析サイトの実戦値を基にした目安であり、正確な保証はない。
 * 数値の調整はこのファイルだけで完結する。
 */

/** 1つの示唆ボタン（ランプの色・点滅方向など） */
export interface HintOption {
  key: string
  label: string
  /** CSSクラス名のサフィックス（lamp-blue 等）。未指定はニュートラル */
  tone?: 'blue' | 'green' | 'yellow' | 'red' | 'rainbow' | 'white'
}

/**
 * 示唆セクション。
 * - mode 'confirm': そのボタンが押されたら confirm[key]（設定番号）未満を除外
 * - mode 'likelihood': likelihood[key]（設定別の尤度比）を推定に乗算
 */
export interface HintSection {
  id: string
  title: string
  caption: string
  mode: 'confirm' | 'likelihood'
  options: HintOption[]
  confirm?: Record<string, number>
  /** 確定表現。'確定' か '濃厚'（既定） */
  confirmWord?: '確定' | '濃厚'
  likelihood?: Record<string, number[]>
}

export interface MachineSpec {
  id: string
  name: string
  shortName: string
  /** 設定ラベル（通常 1〜6） */
  settings: string[]
  /** 設定別 BIG確率の分母（1/x の x） */
  big: number[]
  /** 設定別 REG確率の分母 */
  reg: number[]
  /** 設定別 ベル確率の分母（実戦値目安、無ければ省略可） */
  bell?: number[]
  /** 設定別 BIG中スイカ確率の分母（実戦値目安、無ければ省略可） */
  bigSuika?: number[]
  /** BIG1回あたりの消化ゲーム数（スイカ確率の分母換算） */
  bigGames: number
  hintSections: HintSection[]
}

// --- 共通の尤度比テンプレート ------------------------------------------------

// REG中サイドランプ（色）: 青緑=奇数示唆 / 黄赤=偶数示唆 / 虹=高設定示唆
const SIDE_COLOR_LIKELIHOOD: Record<string, number[]> = {
  blue: [1.4, 0.7, 1.3, 0.7, 1.2, 1.0],
  green: [1.4, 0.7, 1.3, 0.7, 1.2, 1.0],
  yellow: [0.7, 1.4, 0.7, 1.3, 0.8, 1.0],
  red: [0.7, 1.4, 0.7, 1.3, 0.8, 1.0],
  rainbow: [1, 1, 1.5, 1.5, 4, 8],
}

// 終了時ランプ（色）: 白＜青＜黄＜緑＜赤＜虹 の順に高設定へ期待
const GRADIENT_LIKELIHOOD: Record<string, number[]> = {
  white: [1, 1, 1, 1, 1, 1],
  blue: [1, 1.2, 1.3, 1.4, 1.5, 1.6],
  yellow: [1, 1.1, 1.4, 1.6, 2.0, 2.4],
  green: [1, 1.0, 1.6, 2.2, 2.6, 3.2],
  red: [1, 1.0, 1.0, 2.2, 3.2, 4.5],
  rainbow: [1, 1, 1, 1, 3, 20],
}

const FIVE_COLORS: HintOption[] = [
  { key: 'blue', label: '青', tone: 'blue' },
  { key: 'yellow', label: '黄', tone: 'yellow' },
  { key: 'green', label: '緑', tone: 'green' },
  { key: 'red', label: '赤', tone: 'red' },
  { key: 'rainbow', label: '虹', tone: 'rainbow' },
]

const SIX_COLORS: HintOption[] = [{ key: 'white', label: '白', tone: 'white' }, ...FIVE_COLORS]

const SETTINGS_6 = ['1', '2', '3', '4', '5', '6']

// --- 機種定義 ---------------------------------------------------------------

const TENSHO: MachineSpec = {
  id: 'tensho',
  name: 'ハナハナホウオウ〜天翔〜',
  shortName: '天翔',
  settings: SETTINGS_6,
  big: [297, 284, 273, 262, 249, 236],
  reg: [496, 458, 425, 397, 366, 337],
  bell: [7.5, 7.45, 7.4, 7.3, 7.3, 7.2],
  bigSuika: [48, 45, 42, 39, 36, 33],
  bigGames: 24,
  hintSections: [
    {
      id: 'side',
      title: 'REG中サイドランプ',
      caption: '左リール中段に白7ビタでスイカ成立時。青緑=奇数・黄赤=偶数・虹=高設定示唆',
      mode: 'likelihood',
      options: FIVE_COLORS,
      likelihood: SIDE_COLOR_LIKELIHOOD,
    },
    {
      id: 'endBig',
      title: 'BIG終了時トップランプ',
      caption: '青＜黄＜緑＜赤＜虹の順に高設定に期待',
      mode: 'likelihood',
      options: FIVE_COLORS,
      likelihood: GRADIENT_LIKELIHOOD,
    },
    {
      id: 'endReg',
      title: 'REG終了時トップランプ',
      caption: '確定演出: 青=設定2以上・黄=3以上・緑=4以上・赤=5以上・虹=6確定',
      mode: 'confirm',
      confirmWord: '確定',
      options: FIVE_COLORS,
      confirm: { blue: 2, yellow: 3, green: 4, red: 5, rainbow: 6 },
    },
  ],
}

const KING: MachineSpec = {
  id: 'king',
  name: 'Sキングハナハナ-30',
  shortName: 'キング',
  settings: SETTINGS_6,
  big: [292, 280, 268, 257, 244, 232],
  reg: [489, 452, 420, 390, 360, 332],
  bell: [7.25, 7.25, 7.25, 7.05, 6.98, 6.94],
  bigSuika: [48, 45, 43, 40, 37, 34],
  bigGames: 24,
  hintSections: [
    {
      id: 'side',
      title: 'REG中サイドランプ',
      caption: '白7ビタでスイカ成立時。青緑=奇数・黄赤=偶数・虹=高設定示唆',
      mode: 'likelihood',
      options: FIVE_COLORS,
      likelihood: SIDE_COLOR_LIKELIHOOD,
    },
    {
      id: 'featherBig',
      title: 'BIG後フェザーランプ',
      caption: '白＜青＜黄＜緑＜赤＜虹の順に高設定に期待',
      mode: 'likelihood',
      options: SIX_COLORS,
      likelihood: GRADIENT_LIKELIHOOD,
    },
    {
      id: 'featherReg',
      title: 'REG後フェザーランプ（強)',
      caption: 'REG後のほうが示唆が強い。白以外は期待、虹は設定6濃厚',
      mode: 'confirm',
      confirmWord: '濃厚',
      options: FIVE_COLORS,
      confirm: { blue: 2, yellow: 3, green: 4, red: 5, rainbow: 6 },
    },
  ],
}

const STAR: MachineSpec = {
  id: 'star',
  name: 'スターハナハナ-30',
  shortName: 'スター',
  settings: SETTINGS_6,
  big: [270, 262, 252, 240, 229, 218],
  reg: [387, 354, 322, 293, 267, 242],
  bell: [6.36, 6.3, 6.3, 6.26, 6.2, 6.2],
  bigSuika: [48, 45, 42, 39, 36, 33],
  bigGames: 24,
  hintSections: [
    {
      id: 'side',
      title: 'REG中サイドランプ',
      caption: '確定演出: 青=設定2以上・黄=3以上・緑=4以上・赤=5以上・虹=6濃厚',
      mode: 'confirm',
      confirmWord: '濃厚',
      options: FIVE_COLORS,
      confirm: { blue: 2, yellow: 3, green: 4, red: 5, rainbow: 6 },
    },
    {
      id: 'featherBig',
      title: 'BIG後フェザーランプ',
      caption: '白＜青＜黄＜緑＜赤＜虹の順に高設定に期待',
      mode: 'likelihood',
      options: SIX_COLORS,
      likelihood: GRADIENT_LIKELIHOOD,
    },
    {
      id: 'featherReg',
      title: 'REG後フェザーランプ（強)',
      caption: 'REG後のほうが示唆が強い。白以外が出れば期待',
      mode: 'likelihood',
      options: SIX_COLORS,
      likelihood: {
        white: [1, 1, 1, 1, 1, 1],
        blue: [1, 1.4, 1.6, 1.8, 2.0, 2.2],
        yellow: [1, 1.2, 1.8, 2.2, 2.8, 3.4],
        green: [1, 1, 2.0, 2.8, 3.4, 4.2],
        red: [1, 1, 1, 2.8, 4.2, 6.0],
        rainbow: [1, 1, 1, 1, 4, 30],
      },
    },
  ],
}

const NEWKING: MachineSpec = {
  id: 'newking',
  name: 'ニューキングハナハナV',
  shortName: 'ニューキング',
  settings: SETTINGS_6,
  big: [303, 289, 275, 262, 249, 235],
  reg: [504, 468, 432, 397, 367, 336],
  bell: [7.48, 7.44, 7.4, 7.32, 7.25, 7.19],
  bigSuika: [50, 46, 42, 38, 35, 32],
  bigGames: 24,
  hintSections: [
    {
      id: 'sideDir',
      title: 'REG中サイドランプ点滅',
      caption: '左点滅=奇数・右点滅=設定2or4・両点滅=高設定示唆',
      mode: 'likelihood',
      options: [
        { key: 'left', label: '左' },
        { key: 'right', label: '右' },
        { key: 'both', label: '両方', tone: 'rainbow' },
      ],
      likelihood: {
        left: [1.5, 0.8, 1.4, 0.8, 1.3, 1.0],
        right: [0.7, 1.6, 0.7, 1.6, 0.8, 0.9],
        both: [1, 1, 1.4, 1.4, 3, 7],
      },
    },
    {
      id: 'panelBig',
      title: 'BIG終了時パネルフラッシュ',
      caption: '発生で高設定示唆',
      mode: 'likelihood',
      options: [{ key: 'flash', label: '発生', tone: 'red' }],
      likelihood: { flash: [1, 1.2, 1.5, 1.9, 2.4, 3.0] },
    },
    {
      id: 'panelReg',
      title: 'REG終了時パネルフラッシュ',
      caption: '発生で設定3以上濃厚',
      mode: 'confirm',
      confirmWord: '濃厚',
      options: [{ key: 'flash', label: '発生', tone: 'rainbow' }],
      confirm: { flash: 3 },
    },
  ],
}

export const MACHINES: MachineSpec[] = [TENSHO, KING, STAR, NEWKING]

export const DEFAULT_MACHINE_ID = 'tensho'

export function getMachine(id: string): MachineSpec {
  return MACHINES.find((m) => m.id === id) ?? TENSHO
}
