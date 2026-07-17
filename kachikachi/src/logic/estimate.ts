/**
 * ハナハナ系の設定推測ロジック（機種汎用・ベイズ推定）。
 * machines.ts の MachineSpec を受け取り、その機種のスペックで推定する。
 */

import type { BonusData } from './counter'
import type { MachineSpec } from './machines'

export interface EstimateInput {
  games: number
  /** 通常時ベルのカウント */
  bell: number
  bonus: BonusData
  /** 示唆記録: セクションID → 選択肢キー → 回数 */
  hints: Record<string, Record<string, number>>
}

export interface EstimateResult {
  /** 設定ラベル（機種依存） */
  settings: string[]
  /** 各設定の事後確率（合計1）。データなしなら均等 */
  probs: number[]
  /** 確定演出で除外された設定 */
  excluded: boolean[]
  /** 確定演出の説明 */
  notes: string[]
  /** 判別材料が1つでもあるか */
  hasData: boolean
}

/** 二項尤度の対数（組み合わせ項は設定間で共通なので省略） */
function logBinomial(n: number, k: number, p: number): number {
  if (n <= 0) return 0
  const kk = Math.min(k, n)
  return kk * Math.log(p) + (n - kk) * Math.log(1 - p)
}

export function estimate(machine: MachineSpec, input: EstimateInput): EstimateResult {
  const { games, bell, bonus, hints } = input
  const n = machine.settings.length

  const logL = new Array<number>(n).fill(0)
  const excluded = new Array<boolean>(n).fill(false)
  const notes: string[] = []
  let hasData = false

  // --- ボーナス確率 ---
  if (games > 0 && (bonus.big > 0 || bonus.reg > 0)) {
    hasData = true
    for (let s = 0; s < n; s++) {
      logL[s] += logBinomial(games, bonus.big, 1 / machine.big[s])
      logL[s] += logBinomial(games, bonus.reg, 1 / machine.reg[s])
    }
  }

  // --- ベル確率 ---
  if (machine.bell && games > 0 && bell > 0) {
    hasData = true
    for (let s = 0; s < n; s++) {
      logL[s] += logBinomial(games, bell, 1 / machine.bell[s])
    }
  }

  // --- BIG中スイカ（BIG回数×bigGamesを試行回数とみなす） ---
  if (machine.bigSuika && bonus.big > 0 && bonus.bigSuika > 0) {
    hasData = true
    const trials = bonus.big * machine.bigGames
    for (let s = 0; s < n; s++) {
      logL[s] += logBinomial(trials, bonus.bigSuika, 1 / machine.bigSuika[s])
    }
  }

  // --- 示唆セクション ---
  for (const sec of machine.hintSections) {
    const counts = hints[sec.id] ?? {}
    for (const opt of sec.options) {
      const c = counts[opt.key] ?? 0
      if (c <= 0) continue
      hasData = true
      if (sec.mode === 'confirm') {
        const min = sec.confirm?.[opt.key] ?? 1
        for (let s = 0; s < min - 1; s++) excluded[s] = true
        const word = sec.confirmWord ?? '濃厚'
        const label = machine.settings[min - 1]
        notes.push(
          min >= n
            ? `${sec.title}${opt.label}: 設定${label}${word}`
            : `${sec.title}${opt.label}: 設定${label}以上${word}`,
        )
      } else {
        const lr = sec.likelihood?.[opt.key]
        if (lr) for (let s = 0; s < n; s++) logL[s] += c * Math.log(lr[s])
      }
    }
  }

  // 対数尤度 → 正規化した事後確率（事前分布は均等）
  const maxL = Math.max(...logL.map((l, s) => (excluded[s] ? -Infinity : l)))
  const weights = logL.map((l, s) => (excluded[s] ? 0 : Math.exp(l - maxL)))
  const total = weights.reduce((a, b) => a + b, 0)
  const probs = total > 0 ? weights.map((w) => w / total) : new Array<number>(n).fill(1 / n)

  return { settings: machine.settings, probs, excluded, notes, hasData }
}
