import type { SettingLevel, SettingRates } from './types'

/**
 * 設定1〜6の確率テーブル。
 * 値は「1/n」の分母 n。実機アイムジャグラーEXの公表値に準拠。
 * - BIG: 1/273.1〜1/229.1、REG: 1/439.8〜1/229.1（設定6はBIG=REG=1/229.1・合算1/114.6）
 * - ぶどう: 設定1〜5は約1/6.02、設定6のみ約1/5.66（設定判別の主要素）
 * - チェリー: 約1/33.6（全設定共通）、ベル・ピエロ: 約1/1092（全設定共通）
 * midCherry はBIG確定のプレミアムフラグで、BIG確率（big）に内包されている。
 */
export const SETTINGS: Record<SettingLevel, SettingRates> = {
  1: { big: 273.1, reg: 439.8, grape: 6.02, cherry: 33.6, clown: 1092.3, bell: 1092.3, replay: 7.298, midCherry: 3276.8, cherryBig: 1985.7, cherryReg: 1489.5 },
  2: { big: 270.8, reg: 399.6, grape: 6.02, cherry: 33.6, clown: 1092.3, bell: 1092.3, replay: 7.298, midCherry: 3276.8, cherryBig: 1985.7, cherryReg: 1424.7 },
  3: { big: 266.4, reg: 331.0, grape: 6.02, cherry: 33.6, clown: 1092.3, bell: 1092.3, replay: 7.298, midCherry: 3276.8, cherryBig: 1927.5, cherryReg: 1310.7 },
  4: { big: 254.0, reg: 315.1, grape: 6.02, cherry: 33.6, clown: 1092.3, bell: 1092.3, replay: 7.298, midCherry: 3276.8, cherryBig: 1872.5, cherryReg: 1213.6 },
  5: { big: 240.1, reg: 255.0, grape: 6.02, cherry: 33.6, clown: 1092.3, bell: 1092.3, replay: 7.298, midCherry: 3276.8, cherryBig: 1820.4, cherryReg: 1129.9 },
  6: { big: 229.1, reg: 229.1, grape: 5.66, cherry: 33.6, clown: 1092.3, bell: 1092.3, replay: 7.298, midCherry: 3276.8, cherryBig: 1638.4, cherryReg: 1046.5 },
}

export const SETTING_LEVELS: SettingLevel[] = [1, 2, 3, 4, 5, 6]

/** ボーナス合算確率の分母（表示用） */
export function combinedBonusDenom(level: SettingLevel): number {
  const s = SETTINGS[level]
  return 1 / (1 / s.big + 1 / s.reg)
}
