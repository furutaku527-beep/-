import { SETTINGS } from './settings'
import type { AnnounceTiming, Flag, Rng, SettingLevel } from './types'

/**
 * レバーON時の内部抽選。
 *
 * ボーナスは実機同様に「単独」「チェリー重複」「中段チェリー(BIG)」に分かれる。
 * - 中段チェリー：BIG確定・プレミア（BIG確率に内包）
 * - チェリー重複BIG/REG：チェリーと同時にボーナス当選（BIG/REG確率とチェリー
 *   確率の両方に内包）。このゲームはチェリーを表示し、ボーナスは持ち越す
 * - 単独BIG/REG：ボーナスのみ
 * 各カテゴリを差し引くことで、合計のBIG/REG/チェリー確率はテーブル通りになる。
 */
export function spin(level: SettingLevel, rng: Rng = Math.random): Flag {
  const s = SETTINGS[level]
  const r = rng()

  const pMid = 1 / s.midCherry
  const pCherryBig = 1 / s.cherryBig // チェリー重複BIG
  const pCherryReg = 1 / s.cherryReg // チェリー重複REG
  const pBigAlone = 1 / s.big - pMid - pCherryBig // 単独BIG
  const pRegAlone = 1 / s.reg - pCherryReg // 単独REG
  const pCherrySingle = 1 / s.cherry - pCherryBig - pCherryReg // 単チェリー
  const pGrape = 1 / s.grape
  const pClown = 1 / s.clown
  const pBell = 1 / s.bell
  const pReplay = 1 / s.replay

  let acc = 0
  if (r < (acc += pMid)) return { role: 'BIG', midCherry: true }
  if (r < (acc += pCherryBig)) return { role: 'CHERRY', midCherry: false, bonusOverlap: 'BIG' }
  if (r < (acc += pBigAlone)) return { role: 'BIG', midCherry: false }
  if (r < (acc += pCherryReg)) return { role: 'CHERRY', midCherry: false, bonusOverlap: 'REG' }
  if (r < (acc += pRegAlone)) return { role: 'REG', midCherry: false }
  if (r < (acc += pCherrySingle)) return { role: 'CHERRY', midCherry: false }
  if (r < (acc += pGrape)) return { role: 'GRAPE', midCherry: false }
  if (r < (acc += pClown)) return { role: 'CLOWN', midCherry: false }
  if (r < (acc += pBell)) return { role: 'BELL', midCherry: false }
  if (r < (acc += pReplay)) return { role: 'REPLAY', midCherry: false }
  return { role: 'NONE', midCherry: false }
}

/** 先告知 1/4 ／ 後告知 3/4 */
export function drawAnnounceTiming(rng: Rng = Math.random): AnnounceTiming {
  return rng() < 0.25 ? 'pre' : 'post'
}

/**
 * プレミアム告知（レインボー）抽選。
 * 中段チェリーは必ずプレミアム。それ以外は設定が高いほど出やすい。
 */
export function drawPremium(level: SettingLevel, midCherry: boolean, rng: Rng = Math.random): boolean {
  if (midCherry) return true
  return rng() < level / 100 // 設定1:1% 〜 設定6:6%
}
