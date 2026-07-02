import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BonusKind } from '../game/types'

export interface BonusHistoryEntry {
  kind: BonusKind
  /** 前回ボーナスからのゲーム数 */
  games: number
  /** プレミアム告知だったか */
  premium: boolean
  at: number
}

interface StatsState {
  totalGames: number
  bigCount: number
  regCount: number
  grapeCount: number
  cherryCount: number
  replayCount: number
  /** 差枚（払い出し − 投入） */
  diff: number
  /** 前回ボーナスからのゲーム数 */
  gamesSinceBonus: number
  /** ボーナス履歴（新しい順） */
  history: BonusHistoryEntry[]
  /** スランプグラフ用の差枚サンプル */
  slump: number[]

  addGame: (payout: number, bet: number) => void
  countRole: (role: 'GRAPE' | 'CHERRY' | 'REPLAY') => void
  addBonus: (kind: BonusKind, premium: boolean) => void
  addBonusPayout: (payout: number, bet: number) => void
  reset: () => void
}

const MAX_HISTORY = 50
const MAX_SLUMP = 1000

const initial = {
  totalGames: 0,
  bigCount: 0,
  regCount: 0,
  grapeCount: 0,
  cherryCount: 0,
  replayCount: 0,
  diff: 0,
  gamesSinceBonus: 0,
  history: [] as BonusHistoryEntry[],
  slump: [0] as number[],
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set) => ({
      ...initial,

      addGame: (payout, bet) =>
        set((s) => {
          const diff = s.diff + payout - bet
          const slump = [...s.slump, diff]
          if (slump.length > MAX_SLUMP) {
            // 間引いて容量を抑える（2点に1点残す）
            const thinned = slump.filter((_, i) => i % 2 === 0)
            thinned.push(diff)
            return { totalGames: s.totalGames + 1, gamesSinceBonus: s.gamesSinceBonus + 1, diff, slump: thinned }
          }
          return { totalGames: s.totalGames + 1, gamesSinceBonus: s.gamesSinceBonus + 1, diff, slump }
        }),

      countRole: (role) =>
        set((s) => ({
          grapeCount: s.grapeCount + (role === 'GRAPE' ? 1 : 0),
          cherryCount: s.cherryCount + (role === 'CHERRY' ? 1 : 0),
          replayCount: s.replayCount + (role === 'REPLAY' ? 1 : 0),
        })),

      addBonus: (kind, premium) =>
        set((s) => ({
          bigCount: s.bigCount + (kind === 'BIG' ? 1 : 0),
          regCount: s.regCount + (kind === 'REG' ? 1 : 0),
          gamesSinceBonus: 0,
          history: [
            { kind, games: s.gamesSinceBonus, premium, at: Date.now() },
            ...s.history,
          ].slice(0, MAX_HISTORY),
        })),

      addBonusPayout: (payout, bet) =>
        set((s) => {
          const diff = s.diff + payout - bet
          return { diff, slump: [...s.slump.slice(0, -1), diff] }
        }),

      reset: () => set({ ...initial, slump: [0], history: [] }),
    }),
    { name: 'pikapika-stats' },
  ),
)
