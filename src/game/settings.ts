import type { SettingLevel, SettingRates } from './types'

/**
 * 設定1〜6の確率テーブル。
 * 値は「1/n」の分母 n。実機（ノーマルAタイプ）の公表値に準拠。
 * midCherry はBIG確定フラグで、BIG確率（big）に内包されている。
 */
export const SETTINGS: Record<SettingLevel, SettingRates> = {
  1: { big: 273.1, reg: 409.6, grape: 5.9, cherry: 38.1, clown: 1024, bell: 1024, replay: 7.298, midCherry: 3276.8 },
  2: { big: 270.8, reg: 385.5, grape: 5.85, cherry: 38.1, clown: 1024, bell: 1024, replay: 7.298, midCherry: 3276.8 },
  3: { big: 266.4, reg: 336.1, grape: 5.8, cherry: 36.82, clown: 1024, bell: 1024, replay: 7.298, midCherry: 3276.8 },
  4: { big: 254.0, reg: 290.0, grape: 5.78, cherry: 35.62, clown: 1024, bell: 1024, replay: 7.298, midCherry: 3276.8 },
  5: { big: 240.1, reg: 268.6, grape: 5.76, cherry: 35.62, clown: 1024, bell: 1024, replay: 7.298, midCherry: 3276.8 },
  6: { big: 229.1, reg: 229.1, grape: 5.66, cherry: 35.62, clown: 1024, bell: 1024, replay: 7.298, midCherry: 3276.8 },
}

export const SETTING_LEVELS: SettingLevel[] = [1, 2, 3, 4, 5, 6]

/** ボーナス合算確率の分母（表示用） */
export function combinedBonusDenom(level: SettingLevel): number {
  const s = SETTINGS[level]
  return 1 / (1 / s.big + 1 / s.reg)
}
