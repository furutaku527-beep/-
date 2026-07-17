import { describe, it, expect } from 'vitest'
import { createBonus, createHints, type SceneData } from '../src/logic/counter'
import { estimate, type EstimateInput } from '../src/logic/estimate'
import { MACHINES, getMachine } from '../src/logic/machines'

function emptyInput(): EstimateInput {
  return { games: 0, bell: 0, bonus: createBonus(), hints: createHints() }
}

describe('機種スペック（machines.ts）', () => {
  it('全機種が設定数と一致する配列長を持つ', () => {
    for (const m of MACHINES) {
      const n = m.settings.length
      expect(m.big).toHaveLength(n)
      expect(m.reg).toHaveLength(n)
      if (m.bell) expect(m.bell).toHaveLength(n)
      if (m.bigSuika) expect(m.bigSuika).toHaveLength(n)
      // BIG/REG確率は高設定ほど軽い（分母が小さい）
      for (let i = 1; i < n; i++) {
        expect(m.big[i]).toBeLessThan(m.big[i - 1])
        expect(m.reg[i]).toBeLessThan(m.reg[i - 1])
      }
    }
  })

  it('likelihoodセクションは全選択肢に設定数分のLR配列を持つ', () => {
    for (const m of MACHINES) {
      for (const sec of m.hintSections) {
        if (sec.mode !== 'likelihood') continue
        for (const opt of sec.options) {
          expect(sec.likelihood?.[opt.key]).toHaveLength(m.settings.length)
        }
      }
    }
  })

  it('confirmセクションは全選択肢に設定番号を持つ', () => {
    for (const m of MACHINES) {
      for (const sec of m.hintSections) {
        if (sec.mode !== 'confirm') continue
        for (const opt of sec.options) {
          const min = sec.confirm?.[opt.key]
          expect(min).toBeGreaterThanOrEqual(1)
          expect(min).toBeLessThanOrEqual(m.settings.length)
        }
      }
    }
  })

  it('getMachineは未知IDでも天翔にフォールバックする', () => {
    expect(getMachine('unknown').id).toBe('tensho')
    expect(getMachine('king').id).toBe('king')
  })
})

describe('設定推測（機種汎用）', () => {
  it('データなしなら均等でhasData=false', () => {
    const r = estimate(getMachine('tensho'), emptyInput())
    expect(r.hasData).toBe(false)
    for (const p of r.probs) expect(p).toBeCloseTo(1 / 6)
  })

  it('確率の合計は常に1（全機種）', () => {
    for (const m of MACHINES) {
      const input = emptyInput()
      input.games = 3000
      input.bell = 400
      input.bonus = { big: 12, reg: 9, bigSuika: 8 }
      const r = estimate(m, input)
      expect(r.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
    }
  })

  it('設定6ペースのボーナスなら高設定寄りになる（天翔）', () => {
    const input = emptyInput()
    input.games = 5000
    input.bonus = { big: 21, reg: 15, bigSuika: 0 }
    const r = estimate(getMachine('tensho'), input)
    expect(r.probs[4] + r.probs[5]).toBeGreaterThan(r.probs[0] + r.probs[1])
  })

  it('天翔: REG後トップランプ緑で設定1〜3が除外される', () => {
    const input = emptyInput()
    input.hints.endReg = { green: 1 }
    const r = estimate(getMachine('tensho'), input)
    expect(r.excluded.slice(0, 3)).toEqual([true, true, true])
    expect(r.probs[0]).toBe(0)
    expect(r.notes.some((n) => n.includes('設定4以上確定'))).toBe(true)
  })

  it('スター: サイドランプ赤で設定1〜4が除外され濃厚表記', () => {
    const input = emptyInput()
    input.hints.side = { red: 1 }
    const r = estimate(getMachine('star'), input)
    expect(r.excluded.slice(0, 4)).toEqual([true, true, true, true])
    expect(r.notes.some((n) => n.includes('設定5以上濃厚'))).toBe(true)
  })

  it('ニューキング: REGパネルフラッシュで設定1〜2が除外される', () => {
    const input = emptyInput()
    input.hints.panelReg = { flash: 1 }
    const r = estimate(getMachine('newking'), input)
    expect(r.excluded.slice(0, 2)).toEqual([true, true])
    expect(r.notes.some((n) => n.includes('設定3以上濃厚'))).toBe(true)
  })

  it('ニューキング: サイドランプ左点滅で奇数寄りになる', () => {
    const input = emptyInput()
    input.hints.sideDir = { left: 8 }
    const r = estimate(getMachine('newking'), input)
    const odd = r.probs[0] + r.probs[2] + r.probs[4]
    const even = r.probs[1] + r.probs[3]
    expect(odd).toBeGreaterThan(even)
  })

  it('虹ランプで設定6のみになる（天翔 endReg）', () => {
    const input = emptyInput()
    input.hints.endReg = { rainbow: 1 }
    const r = estimate(getMachine('tensho'), input)
    expect(r.probs[5]).toBeCloseTo(1)
  })

  it('別機種のスペックで結果が変わる（同じ入力）', () => {
    const input = emptyInput()
    input.games = 4000
    input.bonus = { big: 16, reg: 12, bigSuika: 0 }
    const tensho = estimate(getMachine('tensho'), input)
    const star = estimate(getMachine('star'), input)
    // スペックが異なるので確率分布は一致しない
    expect(tensho.probs).not.toEqual(star.probs)
  })

  it('ベル数が総回転数を超えても破綻しない', () => {
    const input = emptyInput()
    input.games = 10
    input.bell = 100
    const r = estimate(getMachine('king'), input)
    expect(r.probs.every((p) => Number.isFinite(p))).toBe(true)
    expect(r.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })
})

// SceneData型が示唆の汎用マップを受け入れることの確認
describe('SceneData hints', () => {
  it('任意のセクション/キーを保持できる', () => {
    const scene: SceneData['hints'] = { customSection: { anyKey: 3 } }
    expect(scene.customSection.anyKey).toBe(3)
  })
})
