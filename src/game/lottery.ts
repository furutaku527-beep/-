import { SETTINGS } from './settings'
import type { AnnounceTiming, Flag, Rng, SettingLevel } from './types'

/**
 * レバーON時の内部抽選。
 * 累積確率で順に判定する。中段チェリーはBIG確定なので最初に判定し、
 * 残りのBIG確率から差し引くことで合計のBIG確率がテーブル通りになる。
 */
export function spin(level: SettingLevel, rng: Rng = Math.random): Flag {
  const s = SETTINGS[level]
  const r = rng()

  const pMid = 1 / s.midCherry
  const pBig = 1 / s.big - pMid // 中段チェリー分を除いた単独BIG
  const pReg = 1 / s.reg
  const pGrape = 1 / s.grape
  const pCherry = 1 / s.cherry
  const pClown = 1 / s.clown
  const pBell = 1 / s.bell
  const pReplay = 1 / s.replay

  let acc = 0
  if (r < (acc += pMid)) return { role: 'BIG', midCherry: true }
  if (r < (acc += pBig)) return { role: 'BIG', midCherry: false }
  if (r < (acc += pReg)) return { role: 'REG', midCherry: false }
  if (r < (acc += pGrape)) return { role: 'GRAPE', midCherry: false }
  if (r < (acc += pCherry)) return { role: 'CHERRY', midCherry: false }
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
