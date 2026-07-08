import { spin } from './lottery'
import { BET, bonusNetGain, smallPayout } from './payouts'
import type { Rng, SettingLevel } from './types'

export interface SimResult {
  games: number
  big: number
  reg: number
  grape: number
  cherry: number
  replay: number
  /** 差枚（払い出し − 投入） */
  diff: number
  /** ボーナス合算の実測分母 */
  combinedDenom: number
  grapeDenom: number
  bigDenom: number
  regDenom: number
}

/**
 * 高速シミュレーション。UIを介さず内部抽選と配当だけを回す。
 * ボーナスは当選ゲームで純増枚数を即時加算する（通常ゲーム数ベースの統計になる）。
 */
export function simulate(level: SettingLevel, games: number, rng: Rng = Math.random): SimResult {
  let big = 0
  let reg = 0
  let grape = 0
  let cherry = 0
  let replay = 0
  let diff = 0

  for (let i = 0; i < games; i++) {
    const flag = spin(level, rng)
    if (flag.role !== 'REPLAY') diff -= BET
    // チェリー重複はチェリー払い出し＋ボーナス純増の両方を計上する
    if (flag.bonusOverlap) {
      cherry++
      diff += smallPayout('CHERRY')
      if (flag.bonusOverlap === 'BIG') {
        big++
        diff += bonusNetGain('BIG')
      } else {
        reg++
        diff += bonusNetGain('REG')
      }
      continue
    }
    switch (flag.role) {
      case 'BIG':
        big++
        diff += bonusNetGain('BIG')
        break
      case 'REG':
        reg++
        diff += bonusNetGain('REG')
        break
      case 'GRAPE':
        grape++
        diff += smallPayout('GRAPE')
        break
      case 'CHERRY':
        cherry++
        diff += smallPayout('CHERRY')
        break
      case 'BELL':
      case 'CLOWN':
        diff += smallPayout(flag.role)
        break
      case 'REPLAY':
        replay++
        break
    }
  }

  const bonus = big + reg
  return {
    games,
    big,
    reg,
    grape,
    cherry,
    replay,
    diff,
    combinedDenom: bonus > 0 ? games / bonus : Infinity,
    grapeDenom: grape > 0 ? games / grape : Infinity,
    bigDenom: big > 0 ? games / big : Infinity,
    regDenom: reg > 0 ? games / reg : Infinity,
  }
}

/** テスト用のシード付き乱数（mulberry32） */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
