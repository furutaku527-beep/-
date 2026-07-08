/** 設定段階（1〜6） */
export type SettingLevel = 1 | 2 | 3 | 4 | 5 | 6

/** 内部抽選で決まる役 */
export type Role =
  | 'BIG'
  | 'REG'
  | 'GRAPE'
  | 'CHERRY'
  | 'CLOWN'
  | 'BELL'
  | 'REPLAY'
  | 'NONE'

/** 抽選結果フラグ */
export interface Flag {
  role: Role
  /** 中段チェリー経由のBIG（プレミアム扱い） */
  midCherry: boolean
  /**
   * チェリー重複ボーナス。role='CHERRY' でこの値があると
   * 「チェリーと同時にボーナスを当選」した重複を表す。
   * このゲームはチェリーを表示し、ボーナスは次ゲーム以降に持ち越す。
   */
  bonusOverlap?: BonusKind
}

/** 1設定分の確率テーブル（値は 1/n の分母 n） */
export interface SettingRates {
  big: number
  reg: number
  grape: number
  cherry: number
  clown: number
  bell: number
  replay: number
  /** 中段チェリー（BIG確定・BIG確率に内包） */
  midCherry: number
  /** チェリー重複BIG（BIG確率・チェリー確率の双方に内包） */
  cherryBig: number
  /** チェリー重複REG（REG確率・チェリー確率の双方に内包） */
  cherryReg: number
}

/** ボーナス種別 */
export type BonusKind = 'BIG' | 'REG'

/** 告知タイミング */
export type AnnounceTiming = 'pre' | 'post'

/** リール図柄 */
export type Symbol =
  | 'STAR' // ボーナス図柄（赤7相当のオリジナル）
  | 'BAR' // REG用図柄
  | 'GRAPE'
  | 'CHERRY'
  | 'BELL'
  | 'CLOWN'
  | 'REPLAY'

/** 乱数生成器（テストではシード付きに差し替える） */
export type Rng = () => number
