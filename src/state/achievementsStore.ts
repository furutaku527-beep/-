import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useStatsStore } from './statsStore'

export interface AchievementDef {
  id: string
  title: string
  desc: string
  icon: string
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-big', title: '初BIG', desc: '初めてBIGボーナスを引いた', icon: '🌟' },
  { id: 'first-reg', title: '初REG', desc: '初めてREGボーナスを引いた', icon: '⭐' },
  { id: 'big-chain', title: '連チャン', desc: '100G以内にボーナスを連続で引いた', icon: '🔥' },
  { id: 'premium', title: 'プレミアム', desc: 'レインボー告知を見た', icon: '🌈' },
  { id: 'mid-cherry', title: '奇跡の一粒', desc: '中段チェリーを引いた', icon: '🍒' },
  { id: 'diff-1000', title: '千枚突破', desc: '差枚 +1000枚を達成', icon: '🪙' },
  { id: 'diff-2000', title: '二千枚突破', desc: '差枚 +2000枚を達成', icon: '💰' },
  { id: 'diff-3000', title: '三千枚突破', desc: '差枚 +3000枚を達成', icon: '👑' },
  { id: 'grape-100', title: 'ぶどう100個', desc: 'ぶどうを累計100回揃えた', icon: '🍇' },
  { id: 'grape-1000', title: 'ぶどう農家', desc: 'ぶどうを累計1000回揃えた', icon: '🧺' },
  { id: 'games-1000', title: 'ヘビーユーザー', desc: '累計1000ゲーム到達', icon: '🎰' },
  { id: 'master-6', title: '設定6を掴む', desc: '設定6で2000G以上回して差枚プラス', icon: '🏆' },
]

interface AchievementsState {
  unlocked: Record<string, number> // id → 解除時刻
  /** 直近で解除された実績（トースト表示用） */
  lastUnlocked: AchievementDef | null
  unlock: (id: string) => void
  clearToast: () => void
  /** 現在の統計から解除条件をチェック */
  check: (ctx: { setting: number; premiumSeen?: boolean; midCherry?: boolean }) => void
  reset: () => void
}

export const useAchievementsStore = create<AchievementsState>()(
  persist(
    (set, get) => ({
      unlocked: {},
      lastUnlocked: null,

      unlock: (id) => {
        const { unlocked } = get()
        if (unlocked[id]) return
        const def = ACHIEVEMENTS.find((a) => a.id === id)
        if (!def) return
        set({ unlocked: { ...unlocked, [id]: Date.now() }, lastUnlocked: def })
      },

      clearToast: () => set({ lastUnlocked: null }),

      check: (ctx) => {
        const stats = useStatsStore.getState()
        const { unlock } = get()
        if (stats.bigCount >= 1) unlock('first-big')
        if (stats.regCount >= 1) unlock('first-reg')
        if (ctx.premiumSeen) unlock('premium')
        if (ctx.midCherry) unlock('mid-cherry')
        if (stats.diff >= 1000) unlock('diff-1000')
        if (stats.diff >= 2000) unlock('diff-2000')
        if (stats.diff >= 3000) unlock('diff-3000')
        if (stats.grapeCount >= 100) unlock('grape-100')
        if (stats.grapeCount >= 1000) unlock('grape-1000')
        if (stats.totalGames >= 1000) unlock('games-1000')
        if (ctx.setting === 6 && stats.totalGames >= 2000 && stats.diff > 0) unlock('master-6')
        // 連チャン：直近2回のボーナス間隔が100G以内
        if (stats.history.length >= 2 && stats.history[0].games <= 100) unlock('big-chain')
      },

      reset: () => set({ unlocked: {}, lastUnlocked: null }),
    }),
    { name: 'pikapika-achievements', partialize: (s) => ({ unlocked: s.unlocked }) },
  ),
)
