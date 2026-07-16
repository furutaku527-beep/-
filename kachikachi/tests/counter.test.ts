import { describe, it, expect } from 'vitest'
import {
  createScene,
  createAllScenes,
  increment,
  decrement,
  resetCell,
  resetScene,
  setGames,
  addGames,
  setLabel,
  denominator,
  combinedDenominator,
  formatRatio,
  MAX_VALUE,
  COLOR_KEYS,
} from '../src/logic/counter'

describe('カウント操作', () => {
  it('incrementで+1される', () => {
    let s = createScene()
    s = increment(s, 'white')
    s = increment(s, 'white')
    s = increment(s, 'red')
    expect(s.cells.white.count).toBe(2)
    expect(s.cells.red.count).toBe(1)
    expect(s.cells.green.count).toBe(0)
  })

  it('decrementで-1され、0未満にはならない', () => {
    let s = createScene()
    s = increment(s, 'yellow')
    s = decrement(s, 'yellow')
    expect(s.cells.yellow.count).toBe(0)
    s = decrement(s, 'yellow')
    expect(s.cells.yellow.count).toBe(0)
  })

  it('上限を超えない', () => {
    let s = setGames(createScene(), MAX_VALUE)
    s = addGames(s, 100)
    expect(s.games).toBe(MAX_VALUE)
  })

  it('元のオブジェクトを破壊しない（イミュータブル）', () => {
    const s = createScene()
    const s2 = increment(s, 'white')
    expect(s.cells.white.count).toBe(0)
    expect(s2.cells.white.count).toBe(1)
  })
})

describe('リセット', () => {
  it('resetCellは対象のカウントだけ0にする', () => {
    let s = createScene()
    s = increment(s, 'white')
    s = increment(s, 'red')
    s = resetCell(s, 'white')
    expect(s.cells.white.count).toBe(0)
    expect(s.cells.red.count).toBe(1)
  })

  it('resetSceneは全カウントとG数を0にし、ラベルは保持する', () => {
    let s = createScene()
    s = setLabel(s, 'white', '単独REG')
    s = increment(s, 'white')
    s = setGames(s, 1000)
    s = resetScene(s)
    expect(s.games).toBe(0)
    expect(s.cells.white.count).toBe(0)
    expect(s.cells.white.label).toBe('単独REG')
  })
})

describe('総回転数', () => {
  it('setGamesは0〜上限にクランプし整数化する', () => {
    expect(setGames(createScene(), -5).games).toBe(0)
    expect(setGames(createScene(), 123.9).games).toBe(123)
    expect(setGames(createScene(), NaN).games).toBe(0)
  })

  it('addGamesで増減でき、0未満にならない', () => {
    let s = setGames(createScene(), 100)
    s = addGames(s, 1000)
    expect(s.games).toBe(1100)
    s = addGames(s, -2000)
    expect(s.games).toBe(0)
  })
})

describe('確率計算（実機の÷モード相当）', () => {
  it('総回転数÷カウント数の分母を返す', () => {
    expect(denominator(1200, 200)).toBeCloseTo(6.0)
    expect(denominator(1000, 3)).toBeCloseTo(333.33, 1)
  })

  it('G数0またはカウント0ではnull', () => {
    expect(denominator(0, 10)).toBeNull()
    expect(denominator(1000, 0)).toBeNull()
  })

  it('合算確率（紫→2ボタン相当）はカウント合計で割る', () => {
    expect(combinedDenominator(1000, [100, 100])).toBeCloseTo(5.0)
    expect(combinedDenominator(1000, [100, 100, 50])).toBeCloseTo(4.0)
    expect(combinedDenominator(1000, [0, 0])).toBeNull()
  })

  it('表示フォーマットは1/x.x、算出不能は1/--.-', () => {
    expect(formatRatio(6.02)).toBe('1/6.0')
    expect(formatRatio(333.333)).toBe('1/333.3')
    expect(formatRatio(null)).toBe('1/--.-')
    expect(formatRatio(65536)).toBe('1/65536')
  })
})

describe('シーン独立性', () => {
  it('A/B/Cは互いに独立してカウントされる', () => {
    const scenes = createAllScenes()
    const a = increment(scenes.A, 'white')
    expect(a.cells.white.count).toBe(1)
    expect(scenes.B.cells.white.count).toBe(0)
    expect(scenes.C.cells.white.count).toBe(0)
  })

  it('ラベルは10文字までに切り詰められる', () => {
    const s = setLabel(createScene(), 'white', 'あいうえおかきくけこさし')
    expect(s.cells.white.label).toBe('あいうえおかきくけこ')
  })

  it('全色キーが定義されている', () => {
    expect(COLOR_KEYS).toEqual(['white', 'red', 'green', 'yellow'])
  })
})
