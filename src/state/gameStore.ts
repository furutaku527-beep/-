import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { drawAnnounceTiming, drawPremium, spin } from '../game/lottery'
import { BET, BONUS_GAMES, BONUS_GAME_PAYOUT, smallPayout } from '../game/payouts'
import {
  checkBonusAligned,
  findWins,
  LINES,
  resolveStop,
  STRIP_LENGTH,
  symbolAt,
} from '../game/reels'
import type { LineResult, LineWin } from '../game/reels'
import type { AnnounceTiming, BonusKind, Flag, SettingLevel } from '../game/types'
import * as sfx from '../audio/sfx'
import { useStatsStore } from './statsStore'
import { useAchievementsStore } from './achievementsStore'

/** リール1周にかかるミリ秒（実機準拠：0.75秒/周） */
export const REEL_TURN_MS = 750

/** 1コマ進むのにかかるミリ秒（750ms ÷ 21コマ ≒ 35.7ms） */
export const KOMA_MS = REEL_TURN_MS / STRIP_LENGTH

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
  /** 今ゲームの賭け枚数（1 or 3。3枚=5ライン、1枚=中段のみ） */
  bet: number
  /** 4.1秒ウェイト消化待ち（レバーON済みでリール始動待ち） */
  waiting: boolean
  /** 第3リール停止後、すべり演出中で精算待ち */
  settling: boolean

  /** 全リール停止でアイドル。1つでも回転中なら spinning */
  reels: [ReelState, ReelState, ReelState]
  spinStartAt: number
  /** 今回の回転で使う1コマあたりミリ秒（回転中に速度設定が変わってもブレないよう固定） */
  spinKoma: number
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
  /** 入賞ライン点滅用：光らせるセル [リール, 行(-1/0/+1)] の一覧 */
  winCells: [number, number][]
  /** リール速度（%）。100=実機準拠0.75秒/周、小さいほどゆっくり（目押し用） */
  reelSpeedPct: number

  betMax: () => void
  /** 1枚がけ（MAX BET後に押した場合は差額を払い戻して1枚がけに変更） */
  bet1: () => void
  /** レバーON */
  startSpin: () => void
  /**
   * リール停止。at にはポインタイベントの timeStamp を渡すと、
   * JS処理遅延の影響を受けない「実際に押した瞬間」で押下位置を判定する。
   */
  stopReel: (i: number, at?: number) => void
  setSetting: (level: SettingLevel) => void
  setAuto: (auto: boolean) => void
  setReelSpeed: (pct: number) => void
  toggleMute: () => void
  addCredits: (n: number) => void
  resetAll: () => void
}

/**
 * 回転中に「いま中段にある」図柄のindex。
 * 実機同様、図柄は上から下へ流れる＝indexは回転で減っていく。
 * round で視覚上の中段に最も近いコマを取る（floorだと見た目より最大1コマ遅れる）。
 */
function currentIndex(baseIndex: number, elapsed: number, koma: number): number {
  const advanced = Math.round(Math.max(0, elapsed) / koma)
  return (((baseIndex - advanced) % STRIP_LENGTH) + STRIP_LENGTH) % STRIP_LENGTH
}

/**
 * ポインタイベントの timeStamp を performance クロックに正規化する。
 * （古いブラウザは epoch 基準の timeStamp を返すことがある）
 */
function normalizePressAt(at?: number): number {
  if (at === undefined) return performance.now()
  if (at > 1e11) return at - (Date.now() - performance.now())
  return at
}

/** リール速度(%)から実効の1コマあたりミリ秒を求める（%が小さいほど遅い＝大きいkoma） */
export function komaMsFor(pct: number): number {
  return (KOMA_MS * 100) / Math.max(20, Math.min(100, pct))
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
      bet: 0,
      waiting: false,
      settling: false,
      reels: [
        { spinning: false, index: 2 },
        { spinning: false, index: 4 },
        { spinning: false, index: 6 },
      ],
      spinStartAt: 0,
      spinKoma: KOMA_MS,
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
      winCells: [],
      reelSpeedPct: 100,

      betMax: () => {
        const s = get()
        if (s.waiting || s.settling || s.reels.some((r) => r.spinning)) return
        if (s.replayNext) return // リプレイは自動ベット済み
        // 投入済み枚数（前ゲームの bet の残り値は「投入済み」ではない）
        const current = s.betPlaced ? s.bet : 0
        if (current === BET) return
        const need = BET - current
        if (s.credits < need) return
        sfx.unlockAudio()
        sfx.playBet(need)
        set({ credits: s.credits - need, bet: BET, betPlaced: true, lastPayout: 0, message: '' })
      },

      bet1: () => {
        const s = get()
        if (s.waiting || s.settling || s.reels.some((r) => r.spinning)) return
        if (s.replayNext) return // リプレイは自動ベット済み
        if (s.inBonus) return // ボーナス中は3枚がけのみ
        const current = s.betPlaced ? s.bet : 0
        if (current === 1) return
        const delta = 1 - current // MAX BET後なら -2（2枚払い戻し）
        if (delta > 0 && s.credits < delta) return
        sfx.unlockAudio()
        sfx.playBet(1)
        set({ credits: s.credits - delta, bet: 1, betPlaced: true, lastPayout: 0, message: '' })
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

      stopReel: (i, at) => {
        const s = get()
        if (!s.reels[i].spinning || !s.flag || s.settling) return

        const koma = s.spinKoma
        // 実際に押した瞬間（イベント時刻）で押下コマを判定する
        const cur = currentIndex(s.reels[i].index, normalizePressAt(at) - s.spinStartAt, koma)
        const stoppedIdx: (number | null)[] = s.reels.map((r, j) =>
          r.spinning || j === i ? null : r.index,
        )

        let stopIndex: number
        if (s.inBonus) {
          // ボーナス消化中は毎ゲームぶどうを引き込む（演出）
          stopIndex = resolveStop(i, cur, { role: 'GRAPE', midCherry: false }, null, stoppedIdx, s.bet)
        } else {
          stopIndex = resolveStop(i, cur, s.flag, s.pendingBonus, stoppedIdx, s.bet)
        }

        sfx.playStop()

        const reels = s.reels.map((r, j) =>
          j === i ? { spinning: false, index: stopIndex } : r,
        ) as [ReelState, ReelState, ReelState]

        if (reels.every((r) => !r.spinning)) {
          // すべり演出（最大4コマ）が映像上で止まりきるのを待ってから精算
          const slip = (cur - stopIndex + STRIP_LENGTH) % STRIP_LENGTH
          const delay = slip * koma + 100
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
      setReelSpeed: (pct) => set({ reelSpeedPct: Math.max(20, Math.min(100, Math.round(pct))) }),
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
          bet: 0,
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
          winCells: [],
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
        bet: s.bet,
        pendingBonus: s.pendingBonus,
        inBonus: s.inBonus,
        bonusGamesLeft: s.bonusGamesLeft,
        lamp: s.lamp,
        announceTiming: s.announceTiming,
        premium: s.premium,
        replayNext: s.replayNext,
        reelSpeedPct: s.reelSpeedPct,
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

  lastReelStartAt = Date.now() // 4.1秒ウェイト計算用（壁時計）
  const startPerf = performance.now() // 押下判定・描画用（単調クロック）
  sfx.playReelStart()

  set({
    waiting: false,
    betPlaced: false,
    // 旧バージョンの保存データ（betなし）から復帰した場合の正規化
    bet: s.bet > 0 ? s.bet : BET,
    reels: [
      { spinning: true, index: s.reels[0].index },
      { spinning: true, index: s.reels[1].index },
      { spinning: true, index: s.reels[2].index },
    ],
    spinStartAt: startPerf,
    spinKoma: komaMsFor(s.reelSpeedPct),
    flag,
    pendingBonus,
    lamp,
    announceTiming,
    premium,
    replayNext: false,
    lastPayout: 0,
    message,
    winCells: [],
  })
}

/** 入賞ラインのセル（[リール, 行]）一覧を作る */
function cellsForResult(wins: LineWin[], result: LineResult): [number, number][] {
  return wins
    .filter((w) => w.result === result)
    .flatMap((w) => LINES[w.line].map((row, j) => [j, row] as [number, number]))
}

/** 全リール停止後の精算処理（賭け枚数に応じた有効ラインの表示ベースで判定） */
function settle(set: Set, get: Get): void {
  const s = get()
  const stats = useStatsStore.getState()
  const idx3: [number, number, number] = [s.reels[0].index, s.reels[1].index, s.reels[2].index]
  const gameBet = s.bet > 0 ? s.bet : BET
  const wins = findWins(idx3, gameBet)

  // --- ボーナス消化中 ---
  if (s.inBonus) {
    const payout = BONUS_GAME_PAYOUT
    stats.addBonusPayout(payout, BET)
    sfx.playPayout(payout)
    const winCells = cellsForResult(wins, 'GRAPE')
    const left = s.bonusGamesLeft - 1
    if (left <= 0) {
      sfx.stopBonusBgm()
      set({
        inBonus: null,
        bonusGamesLeft: 0,
        credits: s.credits + payout,
        lastPayout: payout,
        message: 'ボーナス終了',
        winCells,
      })
    } else {
      set({ bonusGamesLeft: left, credits: s.credits + payout, lastPayout: payout, winCells })
    }
    maybeAuto(get)
    return
  }

  // --- ボーナス成立中：図柄がいずれかの有効ラインに揃ったか判定 ---
  if (s.pendingBonus) {
    // 後告知：第3リール停止後に点灯
    let lamp = s.lamp
    if (lamp === 'off') {
      lamp = s.premium ? 'rainbow' : 'on'
      sfx.playNotify()
      if (s.premium) sfx.playPremium()
    }

    if (checkBonusAligned(idx3, s.pendingBonus, gameBet)) {
      const kind = s.pendingBonus
      stats.addBonus(kind, s.premium)
      stats.addGame(0, gameBet) // 揃えたゲーム自体の投入
      sfx.playFanfare()
      sfx.startBonusBgm()
      set({
        pendingBonus: null,
        inBonus: kind,
        bonusGamesLeft: BONUS_GAMES[kind],
        lamp: 'off',
        announceTiming: null,
        message: kind === 'BIG' ? 'BIG BONUS!' : 'REG BONUS!',
        winCells: cellsForResult(wins, kind),
      })
      checkAchievements(get)
      maybeAuto(get)
      return
    }

    stats.addGame(0, gameBet)
    set({ lamp, message: lamp !== s.lamp ? 'ピカッ!' : s.message, winCells: [] })
    checkAchievements(get)
    maybeAuto(get)
    return
  }

  // --- 通常時の払い出し（表示された役だけが有効） ---
  const flag = s.flag ?? { role: 'NONE' as const, midCherry: false }
  const role = flag.role

  if (role === 'REPLAY') {
    stats.addGame(0, 0) // リプレイは実質投入なし
    stats.countRole('REPLAY')
    sfx.playReplay()
    // リプレイは自動ベット（次ゲームは投入不要でレバーON可能）
    set({
      replayNext: true,
      betPlaced: true,
      lastPayout: 0,
      message: 'リプレイ',
      winCells: cellsForResult(wins, 'REPLAY'),
    })
    checkAchievements(get)
    maybeAuto(get)
    return
  }

  let payout = 0
  let winCells: [number, number][] = []
  if (role === 'CHERRY') {
    // チェリーは左リールの有効ライン上に止まった段だけ入賞（取りこぼしあり）。
    // 1枚がけは中段のみ有効
    const activeRows = gameBet >= 3 ? [-1, 0, 1] : [0]
    const rows = activeRows.filter((r) => symbolAt(0, idx3[0] + r) === 'CHERRY')
    if (rows.length > 0) {
      payout = smallPayout('CHERRY')
      winCells = rows.map((r) => [0, r] as [number, number])
      stats.countRole('CHERRY')
    }
  } else if (role === 'GRAPE' || role === 'BELL' || role === 'CLOWN') {
    const displayed = wins.some((w) => w.result === role)
    if (displayed) {
      payout = smallPayout(role)
      winCells = cellsForResult(wins, role)
      if (role === 'GRAPE') stats.countRole('GRAPE')
    }
  }

  stats.addGame(payout, gameBet)
  if (payout > 0) {
    if (role === 'GRAPE') sfx.playWin()
    else if (role === 'CHERRY') sfx.playCherry()
    else if (role === 'BELL') sfx.playBell()
    else if (role === 'CLOWN') sfx.playClown()
    set({ credits: s.credits + payout, lastPayout: payout, winCells })
  } else {
    set({ winCells: [] })
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
