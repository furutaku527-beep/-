import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { drawAnnounceTiming, drawPremium, spin } from '../game/lottery'
import { BET, BONUS_GAMES, BONUS_GAME_PAYOUT, smallPayout } from '../game/payouts'
import { checkBonusAligned, resolveStop, STRIP_LENGTH, symbolAt } from '../game/reels'
import type { AnnounceTiming, BonusKind, Flag, SettingLevel } from '../game/types'
import * as sfx from '../audio/sfx'
import { useStatsStore } from './statsStore'
import { useAchievementsStore } from './achievementsStore'

/**
 * 1コマ進むのにかかるミリ秒。
 * 実機の規定は約80rpm（1周750ms）＝ 21コマで約36ms/コマ。
 * ここでは規定内の約75rpmに設定（1周798ms）。
 */
export const KOMA_MS = 38

/** ゲーム間の最短間隔（4.1秒ウェイト・実機規定） */
export const WAIT_MS = 4100

export type LampState = 'off' | 'on' | 'rainbow'

interface ReelState {
  spinning: boolean
  /** 停止中の中段位置（回転開始時の基準位置でもある） */
  index: number
}

interface GameState {
  credits: number
  setting: SettingLevel
  muted: boolean
  auto: boolean

  /** メダル投入済み（レバーON可能） */
  betPlaced: boolean
  /** 4.1秒ウェイト消化待ち（レバーON済みでリール始動待ち） */
  waiting: boolean
  /** 第3リール停止後、すべり演出中で精算待ち */
  settling: boolean

  /** 全リール停止でアイドル。1つでも回転中なら spinning */
  reels: [ReelState, ReelState, ReelState]
  spinStartAt: number
  /** 今ゲームの内部フラグ */
  flag: Flag | null
  /** 成立中（持ち越し中）のボーナス */
  pendingBonus: BonusKind | null
  /** ボーナス消化中 */
  inBonus: BonusKind | null
  bonusGamesLeft: number
  lamp: LampState
  announceTiming: AnnounceTiming | null
  /** 今ゲームがプレミアム告知か */
  premium: boolean
  /** 次ゲームはリプレイ（自動ベット・投入不要） */
  replayNext: boolean
  /** 直近の払い出し表示 */
  lastPayout: number
  /** 演出用メッセージ */
  message: string

  betMax: () => void
  /** レバーON */
  startSpin: () => void
  stopReel: (i: number) => void
  setSetting: (level: SettingLevel) => void
  setAuto: (auto: boolean) => void
  toggleMute: () => void
  addCredits: (n: number) => void
  resetAll: () => void
}

function currentIndex(baseIndex: number, spinStartAt: number): number {
  const elapsed = Date.now() - spinStartAt
  return (baseIndex + Math.floor(elapsed / KOMA_MS)) % STRIP_LENGTH
}

/** 直近のリール始動時刻（ウェイト計算用） */
let lastReelStartAt = 0
let waitTimer: ReturnType<typeof setTimeout> | null = null
let settleTimer: ReturnType<typeof setTimeout> | null = null

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      credits: 500,
      setting: 3,
      muted: false,
      auto: false,
      betPlaced: false,
      waiting: false,
      settling: false,
      reels: [
        { spinning: false, index: 2 },
        { spinning: false, index: 4 },
        { spinning: false, index: 6 },
      ],
      spinStartAt: 0,
      flag: null,
      pendingBonus: null,
      inBonus: null,
      bonusGamesLeft: 0,
      lamp: 'off',
      announceTiming: null,
      premium: false,
      replayNext: false,
      lastPayout: 0,
      message: '',

      betMax: () => {
        const s = get()
        if (s.betPlaced || s.waiting || s.settling || s.reels.some((r) => r.spinning)) return
        if (s.replayNext) return // リプレイは自動ベット済み
        if (s.credits < BET) return
        sfx.unlockAudio()
        sfx.playBet()
        set({ credits: s.credits - BET, betPlaced: true, lastPayout: 0, message: '' })
      },

      startSpin: () => {
        const s = get()
        if (s.reels.some((r) => r.spinning) || s.waiting || s.settling) return
        if (!s.betPlaced) return

        sfx.unlockAudio()
        sfx.playLever()

        // 4.1秒ウェイト：前回のリール始動から規定時間が経つまで始動を遅らせる
        const delay = Math.max(0, lastReelStartAt + WAIT_MS - Date.now())
        if (delay > 0) {
          set({ waiting: true })
          waitTimer = setTimeout(() => {
            waitTimer = null
            doStart(set, get)
          }, delay)
          return
        }
        doStart(set, get)
      },

      stopReel: (i) => {
        const s = get()
        if (!s.reels[i].spinning || !s.flag || s.settling) return

        const cur = currentIndex(s.reels[i].index, s.spinStartAt)
        const lineSoFar: (ReturnType<typeof symbolAt> | null)[] = s.reels.map((r, j) =>
          r.spinning ? null : symbolAt(j, r.index),
        )

        let stopIndex: number
        if (s.inBonus) {
          // ボーナス消化中は毎ゲームぶどうを引き込む（演出）
          stopIndex = resolveStop(i, cur, { role: 'GRAPE', midCherry: false }, null, lineSoFar)
        } else {
          stopIndex = resolveStop(i, cur, s.flag, s.pendingBonus, lineSoFar)
        }

        sfx.playStop()

        const reels = s.reels.map((r, j) =>
          j === i ? { spinning: false, index: stopIndex } : r,
        ) as [ReelState, ReelState, ReelState]

        if (reels.every((r) => !r.spinning)) {
          // すべり演出（最大4コマ）が映像上で止まりきるのを待ってから精算
          const slip = (stopIndex - cur + STRIP_LENGTH) % STRIP_LENGTH
          const delay = slip * KOMA_MS + 80
          set({ reels, settling: true })
          settleTimer = setTimeout(() => {
            settleTimer = null
            set({ settling: false })
            settle(set, get)
          }, delay)
        } else {
          set({ reels })
        }
      },

      setSetting: (level) => set({ setting: level }),
      setAuto: (auto) => set({ auto }),
      toggleMute: () => {
        const m = !get().muted
        sfx.setMuted(m)
        set({ muted: m })
      },
      addCredits: (n) => set((s) => ({ credits: s.credits + n })),

      resetAll: () => {
        sfx.stopBonusBgm()
        clearAutoTimers()
        if (waitTimer) clearTimeout(waitTimer)
        if (settleTimer) clearTimeout(settleTimer)
        waitTimer = null
        settleTimer = null
        lastReelStartAt = 0
        useStatsStore.getState().reset()
        useAchievementsStore.getState().reset()
        set({
          credits: 500,
          auto: false,
          betPlaced: false,
          waiting: false,
          settling: false,
          reels: [
            { spinning: false, index: 2 },
            { spinning: false, index: 4 },
            { spinning: false, index: 6 },
          ],
          flag: null,
          pendingBonus: null,
          inBonus: null,
          bonusGamesLeft: 0,
          lamp: 'off',
          announceTiming: null,
          premium: false,
          replayNext: false,
          lastPayout: 0,
          message: '',
        })
      },
    }),
    {
      name: 'pikapika-game',
      partialize: (s) => ({
        credits: s.credits,
        setting: s.setting,
        muted: s.muted,
        betPlaced: s.betPlaced,
        pendingBonus: s.pendingBonus,
        inBonus: s.inBonus,
        bonusGamesLeft: s.bonusGamesLeft,
        lamp: s.lamp,
        announceTiming: s.announceTiming,
        premium: s.premium,
        replayNext: s.replayNext,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) sfx.setMuted(state.muted)
      },
    },
  ),
)

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void
type Get = () => GameState

/** レバーON成立後、実際にリールを始動する */
function doStart(set: Set, get: Get): void {
  const s = get()

  let flag: Flag = { role: 'NONE', midCherry: false }
  let pendingBonus = s.pendingBonus
  let lamp: LampState = s.lamp
  let announceTiming = s.announceTiming
  let premium = s.premium
  let message = ''

  if (!s.inBonus && !pendingBonus) {
    // 通常時のみ内部抽選（レバーONの瞬間に当選役が確定する）
    flag = spin(s.setting)
    if (flag.role === 'BIG' || flag.role === 'REG') {
      pendingBonus = flag.role
      announceTiming = drawAnnounceTiming()
      premium = drawPremium(s.setting, flag.midCherry)
      if (announceTiming === 'pre') {
        lamp = premium ? 'rainbow' : 'on'
        sfx.playNotify()
        if (premium) sfx.playPremium()
      }
    }
  }

  if (flag.midCherry) message = '中段チェリー!?'

  lastReelStartAt = Date.now()
  sfx.playReelStart()

  set({
    waiting: false,
    betPlaced: false,
    reels: [
      { spinning: true, index: s.reels[0].index },
      { spinning: true, index: s.reels[1].index },
      { spinning: true, index: s.reels[2].index },
    ],
    spinStartAt: lastReelStartAt,
    flag,
    pendingBonus,
    lamp,
    announceTiming,
    premium,
    replayNext: false,
    lastPayout: 0,
    message,
  })
}

/** 全リール停止後の精算処理 */
function settle(set: Set, get: Get): void {
  const s = get()
  const stats = useStatsStore.getState()
  const line = s.reels.map((r, i) => symbolAt(i, r.index))

  // --- ボーナス消化中 ---
  if (s.inBonus) {
    const payout = BONUS_GAME_PAYOUT
    stats.addBonusPayout(payout, BET)
    sfx.playPayout()
    const left = s.bonusGamesLeft - 1
    if (left <= 0) {
      sfx.stopBonusBgm()
      set({
        inBonus: null,
        bonusGamesLeft: 0,
        credits: s.credits + payout,
        lastPayout: payout,
        message: 'ボーナス終了',
      })
    } else {
      set({ bonusGamesLeft: left, credits: s.credits + payout, lastPayout: payout })
    }
    maybeAuto(get)
    return
  }

  // --- ボーナス成立中：図柄が揃ったか判定 ---
  if (s.pendingBonus) {
    // 後告知：第3リール停止後に点灯
    let lamp = s.lamp
    if (lamp === 'off') {
      lamp = s.premium ? 'rainbow' : 'on'
      sfx.playNotify()
      if (s.premium) sfx.playPremium()
    }

    if (checkBonusAligned(line, s.pendingBonus)) {
      const kind = s.pendingBonus
      stats.addBonus(kind, s.premium)
      stats.addGame(0, BET) // 揃えたゲーム自体の投入
      sfx.playFanfare()
      sfx.startBonusBgm()
      set({
        pendingBonus: null,
        inBonus: kind,
        bonusGamesLeft: BONUS_GAMES[kind],
        lamp: 'off',
        announceTiming: null,
        message: kind === 'BIG' ? 'BIG BONUS!' : 'REG BONUS!',
      })
      checkAchievements(get)
      maybeAuto(get)
      return
    }

    stats.addGame(0, BET)
    set({ lamp, message: lamp !== s.lamp ? 'ピカッ!' : s.message })
    checkAchievements(get)
    maybeAuto(get)
    return
  }

  // --- 通常時の払い出し ---
  const flag = s.flag ?? { role: 'NONE' as const, midCherry: false }
  const payout = smallPayout(flag.role)
  const bet = BET

  if (flag.role === 'GRAPE' || flag.role === 'CHERRY' || flag.role === 'REPLAY') {
    stats.countRole(flag.role)
  }

  if (flag.role === 'REPLAY') {
    stats.addGame(0, 0) // リプレイは実質投入なし
    sfx.playReplay()
    // リプレイは自動ベット（次ゲームは投入不要でレバーON可能）
    set({ replayNext: true, betPlaced: true, lastPayout: 0, message: 'リプレイ' })
  } else {
    stats.addGame(payout, bet)
    if (payout > 0) {
      sfx.playWin()
      set({ credits: s.credits + payout, lastPayout: payout })
    }
  }

  checkAchievements(get)
  maybeAuto(get)
}

function checkAchievements(get: Get): void {
  const s = get()
  useAchievementsStore.getState().check({
    setting: s.setting,
    premiumSeen: s.premium && (s.lamp === 'rainbow' || s.inBonus !== null),
    midCherry: s.flag?.midCherry ?? false,
  })
}

/** オートプレイ：投入→レバー→順番に停止、を繰り返す */
let autoTimers: ReturnType<typeof setTimeout>[] = []

function maybeAuto(get: Get): void {
  const s = get()
  if (!s.auto) return
  clearAutoTimers()
  autoTimers.push(setTimeout(autoStep, 400))
}

function autoStep(): void {
  const st = useGameStore.getState()
  if (!st.auto) return
  if (st.reels.some((r) => r.spinning) || st.settling) {
    autoTimers.push(setTimeout(autoStep, 200))
    return
  }
  if (!st.betPlaced) {
    if (st.credits < BET) {
      useGameStore.setState({ auto: false })
      return
    }
    st.betMax()
  }
  useGameStore.getState().startSpin()

  // ウェイト中の可能性があるため、リールが実際に回り始めてから停止を予約する
  const poll = setInterval(() => {
    const s = useGameStore.getState()
    if (!s.auto) {
      clearInterval(poll)
      return
    }
    if (s.reels.every((r) => r.spinning)) {
      clearInterval(poll)
      const delays = [600, 950, 1300].map((d) => d + Math.random() * 300)
      delays.forEach((d, i) => {
        autoTimers.push(setTimeout(() => useGameStore.getState().stopReel(i), d))
      })
    }
  }, 120)
  autoTimers.push(poll as unknown as ReturnType<typeof setTimeout>)
}

export function clearAutoTimers(): void {
  autoTimers.forEach((t) => {
    clearTimeout(t)
    clearInterval(t as unknown as ReturnType<typeof setInterval>)
  })
  autoTimers = []
}

/** オートON時に即開始するためのフック用ヘルパー */
export function kickAuto(): void {
  maybeAuto(useGameStore.getState)
}
