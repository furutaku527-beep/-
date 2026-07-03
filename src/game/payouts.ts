import type { BonusKind, Role } from './types'

/** 1ゲームの投入枚数（3枚掛け固定） */
export const BET = 3

/** 小役の払い出し枚数 */
export const SMALL_PAYOUTS: Partial<Record<Role, number>> = {
  BELL: 14,
  CLOWN: 10,
  GRAPE: 8,
  CHERRY: 2,
}

/** ボーナス中の1ゲームあたり払い出し枚数 */
export const BONUS_GAME_PAYOUT = 15

/** ボーナス消化ゲーム数（純増 = (15-3) × ゲーム数 → BIG:240枚 / REG:96枚） */
export const BONUS_GAMES: Record<BonusKind, number> = {
  BIG: 20,
  REG: 8,
}

/** ボーナスの純増枚数 */
export function bonusNetGain(kind: BonusKind): number {
  return (BONUS_GAME_PAYOUT - BET) * BONUS_GAMES[kind]
}

/** 通常ゲームの払い出し枚数（リプレイは0枚だが次ゲーム投入不要） */
export function smallPayout(role: Role): number {
  return SMALL_PAYOUTS[role] ?? 0
}
