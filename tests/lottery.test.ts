import { describe, expect, it } from 'vitest'
import { spin } from '../src/game/lottery'
import { bonusNetGain } from '../src/game/payouts'
import { combinedBonusDenom, SETTINGS } from '../src/game/settings'
import { mulberry32, simulate } from '../src/game/simulate'

describe('確率テーブル', () => {
  it('全設定で各役の確率合計が1未満', () => {
    for (const s of Object.values(SETTINGS)) {
      const total =
        1 / s.big + 1 / s.reg + 1 / s.grape + 1 / s.cherry + 1 / s.clown + 1 / s.bell + 1 / s.replay
      expect(total).toBeLessThan(1)
    }
  })

  it('設定6の合算は約1/114.6', () => {
    expect(combinedBonusDenom(6)).toBeCloseTo(114.55, 1)
  })
})

describe('配当', () => {
  it('BIGの純増は252枚（アイム相当）', () => {
    expect(bonusNetGain('BIG')).toBe(252)
  })
  it('REGの純増は96枚', () => {
    expect(bonusNetGain('REG')).toBe(96)
  })
})

describe('収束テスト（設定6・200,000G）', () => {
  const result = simulate(6, 200_000, mulberry32(20260702))

  it('ボーナス合算が概ね1/115前後（±8%）', () => {
    const theory = combinedBonusDenom(6)
    expect(result.combinedDenom).toBeGreaterThan(theory * 0.92)
    expect(result.combinedDenom).toBeLessThan(theory * 1.08)
  })

  it('ぶどうが概ね1/5.7前後（±3%）', () => {
    expect(result.grapeDenom).toBeGreaterThan(5.66 * 0.97)
    expect(result.grapeDenom).toBeLessThan(5.66 * 1.03)
  })

  it('BIG確率が理論値1/229.1に収束（±10%）', () => {
    expect(result.bigDenom).toBeGreaterThan(229.1 * 0.9)
    expect(result.bigDenom).toBeLessThan(229.1 * 1.1)
  })

  it('REG確率が理論値1/229.1に収束（±10%）', () => {
    expect(result.regDenom).toBeGreaterThan(229.1 * 0.9)
    expect(result.regDenom).toBeLessThan(229.1 * 1.1)
  })
})

describe('設定差（2,000,000G）', () => {
  it('設定1は長期的に差枚マイナス', () => {
    const r = simulate(1, 2_000_000, mulberry32(1))
    expect(r.diff).toBeLessThan(0)
  })

  it('設定6は長期的に差枚プラス', () => {
    const r = simulate(6, 2_000_000, mulberry32(6))
    expect(r.diff).toBeGreaterThan(0)
  })
})

describe('中段チェリー', () => {
  it('BIG確定フラグとして約1/3277で出現', () => {
    const rng = mulberry32(777)
    let mid = 0
    const N = 1_000_000
    for (let i = 0; i < N; i++) {
      const f = spin(6, rng)
      if (f.midCherry) {
        expect(f.role).toBe('BIG')
        mid++
      }
    }
    const denom = N / mid
    expect(denom).toBeGreaterThan(3276.8 * 0.85)
    expect(denom).toBeLessThan(3276.8 * 1.15)
  })
})
