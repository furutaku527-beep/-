import { describe, it, expect } from 'vitest'
import { createBonus, createHints } from '../src/logic/counter'
import { estimateSettings, SETTING_COUNT } from '../src/logic/tensho'

function emptyInput() {
  return { games: 0, bell: 0, bonus: createBonus(), hints: createHints() }
}

describe('設定推測（ハナハナ天翔）', () => {
  it('データなしなら均等でhasData=false', () => {
    const r = estimateSettings(emptyInput())
    expect(r.hasData).toBe(false)
    expect(r.probs).toHaveLength(SETTING_COUNT)
    for (const p of r.probs) expect(p).toBeCloseTo(1 / 6)
  })

  it('確率の合計は常に1', () => {
    const input = emptyInput()
    input.games = 3000
    input.bell = 400
    input.bonus = { big: 12, reg: 9, bigSuika: 8 }
    const r = estimateSettings(input)
    expect(r.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })

  it('設定6ペースのボーナス確率なら高設定寄りになる', () => {
    const input = emptyInput()
    input.games = 5000
    // 設定6ペース: BIG 1/236, REG 1/337
    input.bonus = { big: 21, reg: 15, bigSuika: 0 }
    const r = estimateSettings(input)
    const low = r.probs[0] + r.probs[1]
    const high = r.probs[4] + r.probs[5]
    expect(high).toBeGreaterThan(low)
  })

  it('設定1ペースのボーナス確率なら低設定寄りになる', () => {
    const input = emptyInput()
    input.games = 5000
    // 設定1ペース: BIG 1/297, REG 1/496
    input.bonus = { big: 17, reg: 10, bigSuika: 0 }
    const r = estimateSettings(input)
    expect(r.probs[0] + r.probs[1]).toBeGreaterThan(r.probs[4] + r.probs[5])
  })

  it('REG後トップランプ緑で設定1〜3が除外される', () => {
    const input = emptyInput()
    input.hints.endReg.green = 1
    const r = estimateSettings(input)
    expect(r.excluded.slice(0, 3)).toEqual([true, true, true])
    expect(r.probs[0]).toBe(0)
    expect(r.probs[1]).toBe(0)
    expect(r.probs[2]).toBe(0)
    expect(r.notes.some((n) => n.includes('設定4以上確定'))).toBe(true)
  })

  it('REG後トップランプ虹で設定6のみになる', () => {
    const input = emptyInput()
    input.hints.endReg.rainbow = 1
    const r = estimateSettings(input)
    expect(r.probs[5]).toBeCloseTo(1)
    expect(r.notes.some((n) => n.includes('設定6確定'))).toBe(true)
  })

  it('サイドランプ寒色多数なら奇数設定寄りになる', () => {
    const input = emptyInput()
    input.hints.side.blue = 6
    input.hints.side.green = 4
    const r = estimateSettings(input)
    // 奇数(1,3,5)の合計 > 偶数(2,4)の合計
    const odd = r.probs[0] + r.probs[2] + r.probs[4]
    const even = r.probs[1] + r.probs[3]
    expect(odd).toBeGreaterThan(even)
  })

  it('BIG中スイカが軽いほど高設定寄りになる', () => {
    const base = emptyInput()
    base.bonus = { big: 20, reg: 0, bigSuika: 10 } // 480Gで10回 = 1/48ペース（設定1）
    const light = emptyInput()
    light.bonus = { big: 20, reg: 0, bigSuika: 15 } // 1/32ペース（設定6超）
    const rBase = estimateSettings(base)
    const rLight = estimateSettings(light)
    expect(rLight.probs[5]).toBeGreaterThan(rBase.probs[5])
  })

  it('ベルが軽いと設定6の比重が上がる', () => {
    const heavy = emptyInput()
    heavy.games = 3000
    heavy.bell = 400 // 1/7.5ペース（設定1）
    const light = emptyInput()
    light.games = 3000
    light.bell = 417 // 1/7.2ペース（設定6）
    const rHeavy = estimateSettings(heavy)
    const rLight = estimateSettings(light)
    expect(rLight.probs[5]).toBeGreaterThan(rHeavy.probs[5])
  })

  it('ベル数が総回転数を超えても破綻しない', () => {
    const input = emptyInput()
    input.games = 10
    input.bell = 100
    const r = estimateSettings(input)
    expect(r.probs.every((p) => Number.isFinite(p))).toBe(true)
    expect(r.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })
})
