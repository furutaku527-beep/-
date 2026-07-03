import { describe, expect, it } from 'vitest'
import {
  checkBonusAligned,
  evalLine,
  findWins,
  LINES,
  resolveStop,
  STRIP_LENGTH,
  STRIPS,
  symbolAt,
  windowSymbols,
} from '../src/game/reels'
import type { Flag } from '../src/game/types'

const noFlag: Flag = { role: 'NONE', midCherry: false }

/** 順押し（0→1→2）で3リールを止めた結果の停止index */
function stopAll(
  curs: [number, number, number],
  flag: Flag,
  pending: 'BIG' | 'REG' | null = null,
  order: number[] = [0, 1, 2],
): [number, number, number] {
  const stopped: (number | null)[] = [null, null, null]
  for (const reel of order) {
    stopped[reel] = resolveStop(reel, curs[reel], flag, pending, stopped)
  }
  return stopped as [number, number, number]
}

describe('リール配列', () => {
  it('全リールが21コマ', () => {
    for (const strip of STRIPS) expect(strip).toHaveLength(STRIP_LENGTH)
  })

  it('左リールはチェリー付BAR（チェリーがBARの直上）', () => {
    const bars = STRIPS[0].flatMap((s, i) => (s === 'BAR' ? [i] : []))
    expect(bars.length).toBe(2)
    for (const b of bars) {
      expect(symbolAt(0, b - 1)).toBe('CHERRY')
    }
  })

  it('右リールは7の直下にBAR（逆押しでREGフォロー可能）', () => {
    const stars = STRIPS[2].flatMap((s, i) => (s === 'STAR' ? [i] : []))
    expect(stars.length).toBeGreaterThan(0)
    for (const st of stars) {
      expect(symbolAt(2, st + 1)).toBe('BAR')
    }
  })

  it('ボーナス図柄（STAR）は引き込めない位置がある（目押し要素）', () => {
    for (let reel = 0; reel < 3; reel++) {
      let misses = 0
      for (let cur = 0; cur < STRIP_LENGTH; cur++) {
        let reachable = false
        for (let slip = 0; slip <= 4; slip++) {
          for (const row of [-1, 0, 1]) {
            if (symbolAt(reel, cur - slip + row) === 'STAR') reachable = true
          }
        }
        if (!reachable) misses++
      }
      expect(misses).toBeGreaterThan(0)
    }
  })
})

describe('停止制御（5ライン）', () => {
  it('ぶどフラグ時は全押し位置でいずれかの有効ラインに揃う', () => {
    const flag: Flag = { role: 'GRAPE', midCherry: false }
    for (let c0 = 0; c0 < STRIP_LENGTH; c0++) {
      for (let c1 = 0; c1 < STRIP_LENGTH; c1++) {
        for (let c2 = 0; c2 < STRIP_LENGTH; c2++) {
          const idx = stopAll([c0, c1, c2], flag)
          const wins = findWins(idx)
          expect(wins.some((w) => w.result === 'GRAPE')).toBe(true)
        }
      }
    }
  })

  it('リプレイフラグ時は全押し位置でいずれかの有効ラインに揃う', () => {
    const flag: Flag = { role: 'REPLAY', midCherry: false }
    for (let c0 = 0; c0 < STRIP_LENGTH; c0++) {
      for (let c1 = 0; c1 < STRIP_LENGTH; c1++) {
        for (let c2 = 0; c2 < STRIP_LENGTH; c2++) {
          const idx = stopAll([c0, c1, c2], flag)
          expect(findWins(idx).some((w) => w.result === 'REPLAY')).toBe(true)
        }
      }
    }
  })

  it('変則押し（中→右→左）でもぶどうは取りこぼさない', () => {
    const flag: Flag = { role: 'GRAPE', midCherry: false }
    for (let c0 = 0; c0 < STRIP_LENGTH; c0 += 2) {
      for (let c1 = 0; c1 < STRIP_LENGTH; c1 += 2) {
        for (let c2 = 0; c2 < STRIP_LENGTH; c2 += 2) {
          const idx = stopAll([c0, c1, c2], flag, null, [1, 2, 0])
          expect(findWins(idx).some((w) => w.result === 'GRAPE')).toBe(true)
        }
      }
    }
  })

  it('ハズレ時は全押し位置でどのラインにも役が揃わず、チェリーも表示されない', () => {
    for (let c0 = 0; c0 < STRIP_LENGTH; c0++) {
      for (let c1 = 0; c1 < STRIP_LENGTH; c1++) {
        for (let c2 = 0; c2 < STRIP_LENGTH; c2++) {
          const idx = stopAll([c0, c1, c2], noFlag)
          expect(findWins(idx)).toHaveLength(0)
          expect(windowSymbols(0, idx[0])).not.toContain('CHERRY')
        }
      }
    }
  })

  it('すべりは最大4コマ以内', () => {
    for (const flag of [noFlag, { role: 'GRAPE', midCherry: false } as Flag]) {
      for (let reel = 0; reel < 3; reel++) {
        for (let cur = 0; cur < STRIP_LENGTH; cur++) {
          const idx = resolveStop(reel, cur, flag, null, [null, null, null])
          const slip = (cur - idx + STRIP_LENGTH) % STRIP_LENGTH
          expect(slip).toBeLessThanOrEqual(4)
        }
      }
    }
  })

  it('左リールBAR狙いでチェリーが角に止まる（±1コマの押しズレ込み）', () => {
    const flag: Flag = { role: 'CHERRY', midCherry: false }
    const bars = STRIPS[0].flatMap((s, i) => (s === 'BAR' ? [i] : []))
    for (const bar of bars) {
      for (const d of [-1, 0, 1]) {
        const cur = (bar + d + STRIP_LENGTH) % STRIP_LENGTH
        const idx = resolveStop(0, cur, flag, null, [null, null, null])
        const win = windowSymbols(0, idx)
        expect(win).toContain('CHERRY')
        // 通常チェリーは中段（プレミアム表示）にはしない
        expect(win[1]).not.toBe('CHERRY')
      }
    }
  })

  it('中段チェリー成立時はBAR狙いで左リール中段にチェリーが止まる', () => {
    const flag: Flag = { role: 'BIG', midCherry: true }
    const bars = STRIPS[0].flatMap((s, i) => (s === 'BAR' ? [i] : []))
    for (const bar of bars) {
      const idx = resolveStop(0, bar, flag, 'BIG', [null, null, null])
      expect(symbolAt(0, idx)).toBe('CHERRY')
    }
  })

  it('BIG成立中：目押しすればBIGが揃い、checkBonusAlignedが検出する', () => {
    // 左BAR狙い(3)→中リール7ビタ(11)→右リール7ビタ(5)
    const idx = stopAll([3, 11, 5], noFlag, 'BIG')
    expect(checkBonusAligned(idx, 'BIG')).toBe(true)
    expect(checkBonusAligned(idx, 'REG')).toBe(false)
  })

  it('REG成立中：右リールにBARを引き込んでREGが揃う', () => {
    const idx = stopAll([3, 11, 6], noFlag, 'REG')
    expect(checkBonusAligned(idx, 'REG')).toBe(true)
  })

  it('ボーナス成立中でも目押しが外れれば揃わない（取りこぼし）', () => {
    // 中リールの7(11)から遠い位置で押す
    const idx = stopAll([3, 4, 12], noFlag, 'BIG')
    expect(checkBonusAligned(idx, 'BIG')).toBe(false)
    // ハズレ表示にもならない
    expect(findWins(idx)).toHaveLength(0)
  })
})

describe('ライン判定', () => {
  it('5ラインが定義されている', () => {
    expect(LINES).toHaveLength(5)
  })

  it('evalLine: BIG / REG / 小役揃いを判定', () => {
    expect(evalLine(['STAR', 'STAR', 'STAR'])).toBe('BIG')
    expect(evalLine(['STAR', 'STAR', 'BAR'])).toBe('REG')
    expect(evalLine(['GRAPE', 'GRAPE', 'GRAPE'])).toBe('GRAPE')
    expect(evalLine(['GRAPE', 'REPLAY', 'GRAPE'])).toBeNull()
    expect(evalLine(['GRAPE', null, 'GRAPE'])).toBeNull()
  })

  it('findWins: 斜めラインの揃いも検出する', () => {
    // 左7を上段(=中段index+1が7になる位置)、中7を中段、右7を下段に置く → 右下がりBIG
    const leftTop = STRIPS[0].indexOf('STAR') + 1 // 上段に7
    const midCenter = STRIPS[1].indexOf('STAR')
    const rightBottom = STRIPS[2].indexOf('STAR') - 1 // 下段に7
    const wins = findWins([leftTop, midCenter, rightBottom])
    expect(wins.some((w) => w.result === 'BIG')).toBe(true)
  })
})
