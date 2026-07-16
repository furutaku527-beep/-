/**
 * ハナハナホウオウ〜天翔〜の設定推測ロジック（ベイズ推定）。
 *
 * ボーナス確率は公表値ベース、ベル・BIG中スイカ・示唆ランプの振り分けは
 * 解析サイトの実戦値を基にした目安。示唆ランプのうちREG終了時トップランプは
 * 「青=設定2以上/黄=3以上/緑=4以上/赤=5以上/虹=6」の確定演出として扱い、
 * 該当しない設定を除外する。BIG終了時トップランプと虹サイドランプは
 * 実戦傾向に基づく尤度比（ヒューリスティック）で反映する。
 */

import type { BonusData, HintData, LampColor } from './counter'

export const SETTING_COUNT = 6

/** BIG1回あたりの消化ゲーム数（スイカ確率の分母換算に使う） */
export const BIG_GAMES = 24

interface TenshoSpec {
  /** 1/x 表記の分母（設定1〜6） */
  big: number[]
  reg: number[]
  bell: number[]
  bigSuika: number[]
  /** REG中サイドランプが寒色（青/緑）になる割合 */
  sideCool: number[]
  /** 虹サイドランプ1回あたりの尤度比（目安） */
  sideRainbowLR: number[]
  /** BIG終了時トップランプ点灯1回あたりの尤度比（色別・目安） */
  endBigLR: Record<LampColor, number[]>
  /** REG終了時トップランプの確定ライン（この設定以上が確定） */
  endRegMin: Record<LampColor, number>
}

export const TENSHO_SPEC: TenshoSpec = {
  // 公表値ベースのボーナス確率
  big: [297, 284, 273, 262, 249, 236],
  reg: [496, 458, 425, 397, 366, 337],
  // 実戦値の目安
  bell: [7.5, 7.45, 7.4, 7.3, 7.3, 7.2],
  bigSuika: [48, 45, 42, 39, 36, 33],
  // 青緑:黄赤 = 奇数6:4 / 偶数4:6 / 設定6は均等
  sideCool: [0.6, 0.4, 0.6, 0.4, 0.6, 0.5],
  sideRainbowLR: [1, 1, 1.5, 1.5, 4, 8],
  endBigLR: {
    blue: [1, 1.3, 1.3, 1.6, 1.6, 1.6],
    yellow: [1, 1.3, 1.6, 1.6, 2.2, 2.2],
    green: [1, 1, 1.8, 2.4, 2.4, 3],
    red: [1, 1, 1, 2.5, 3.5, 5],
    rainbow: [1, 1, 1, 1, 3, 30],
  },
  endRegMin: { blue: 2, yellow: 3, green: 4, red: 5, rainbow: 6 },
}

const LAMP_NAMES: Record<LampColor, string> = {
  blue: '青',
  green: '緑',
  yellow: '黄',
  red: '赤',
  rainbow: '虹',
}

export interface EstimateInput {
  games: number
  /** 通常時ベルのカウント */
  bell: number
  bonus: BonusData
  hints: HintData
}

export interface EstimateResult {
  /** 設定1〜6の事後確率（合計1）。データなしなら均等 */
  probs: number[]
  /** 確定演出で除外された設定 */
  excluded: boolean[]
  /** 確定演出の説明（例: 「REG後トップランプ緑: 設定4以上確定」） */
  notes: string[]
  /** 判別材料が1つでもあるか */
  hasData: boolean
}

/** 二項尤度の対数（組み合わせ項は設定間で共通なので省略） */
function logBinomial(n: number, k: number, p: number): number {
  const kk = Math.min(k, n)
  if (n <= 0) return 0
  return kk * Math.log(p) + (n - kk) * Math.log(1 - p)
}

export function estimateSettings(input: EstimateInput): EstimateResult {
  const { games, bell, bonus, hints } = input
  const spec = TENSHO_SPEC

  const logL = new Array<number>(SETTING_COUNT).fill(0)
  const excluded = new Array<boolean>(SETTING_COUNT).fill(false)
  const notes: string[] = []
  let hasData = false

  // --- ボーナス確率（総回転数に対するBIG/REG回数） ---
  if (games > 0 && (bonus.big > 0 || bonus.reg > 0)) {
    hasData = true
    for (let s = 0; s < SETTING_COUNT; s++) {
      logL[s] += logBinomial(games, bonus.big, 1 / spec.big[s])
      logL[s] += logBinomial(games, bonus.reg, 1 / spec.reg[s])
    }
  }

  // --- ベル確率 ---
  if (games > 0 && bell > 0) {
    hasData = true
    for (let s = 0; s < SETTING_COUNT; s++) {
      logL[s] += logBinomial(games, bell, 1 / spec.bell[s])
    }
  }

  // --- BIG中スイカ（BIG回数×24Gを試行回数とみなす） ---
  if (bonus.big > 0 && bonus.bigSuika > 0) {
    hasData = true
    const n = bonus.big * BIG_GAMES
    for (let s = 0; s < SETTING_COUNT; s++) {
      logL[s] += logBinomial(n, bonus.bigSuika, 1 / spec.bigSuika[s])
    }
  }

  // --- REG中サイドランプ（寒色=奇数示唆 / 暖色=偶数示唆） ---
  const cool = hints.side.blue + hints.side.green
  const warm = hints.side.yellow + hints.side.red
  if (cool + warm > 0) {
    hasData = true
    for (let s = 0; s < SETTING_COUNT; s++) {
      const p = spec.sideCool[s]
      logL[s] += cool * Math.log(p) + warm * Math.log(1 - p)
    }
  }
  if (hints.side.rainbow > 0) {
    hasData = true
    for (let s = 0; s < SETTING_COUNT; s++) {
      logL[s] += hints.side.rainbow * Math.log(spec.sideRainbowLR[s])
    }
  }

  // --- BIG終了時トップランプ（色別の尤度比・目安） ---
  for (const color of Object.keys(spec.endBigLR) as LampColor[]) {
    const count = hints.endBig[color]
    if (count > 0) {
      hasData = true
      for (let s = 0; s < SETTING_COUNT; s++) {
        logL[s] += count * Math.log(spec.endBigLR[color][s])
      }
    }
  }

  // --- REG終了時トップランプ（確定演出: 下位設定を除外） ---
  for (const color of Object.keys(spec.endRegMin) as LampColor[]) {
    if (hints.endReg[color] > 0) {
      hasData = true
      const min = spec.endRegMin[color]
      for (let s = 0; s < min - 1; s++) excluded[s] = true
      notes.push(
        min === 6
          ? `REG後トップランプ${LAMP_NAMES[color]}: 設定6確定`
          : `REG後トップランプ${LAMP_NAMES[color]}: 設定${min}以上確定`,
      )
    }
  }

  // 対数尤度 → 正規化した事後確率（事前分布は均等）
  const maxL = Math.max(...logL.map((l, s) => (excluded[s] ? -Infinity : l)))
  const weights = logL.map((l, s) => (excluded[s] ? 0 : Math.exp(l - maxL)))
  const total = weights.reduce((a, b) => a + b, 0)
  const probs =
    total > 0
      ? weights.map((w) => w / total)
      : new Array<number>(SETTING_COUNT).fill(1 / SETTING_COUNT)

  return { probs, excluded, notes, hasData }
}
