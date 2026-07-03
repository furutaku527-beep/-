import { describe, expect, it } from 'vitest'
import {
  checkBonusAligned,
  findPullIn,
  resolveStop,
  STRIP_LENGTH,
  STRIPS,
  symbolAt,
  windowSymbols,
} from '../src/game/reels'
import type { Flag } from '../src/game/types'

const noFlag: Flag = { role: 'NONE', midCherry: false }

describe('リール配列', () => {
  it('全リールが21コマ', () => {
    for (const strip of STRIPS) expect(strip).toHaveLength(STRIP_LENGTH)
  })

  it('ぶどうはどの位置からでも4コマ以内に引き込める', () => {
    for (let reel = 0; reel < 3; reel++) {
      for (let cur = 0; cur < STRIP_LENGTH; cur++) {
        expect(findPullIn(reel, cur, 'GRAPE')).not.toBeNull()
      }
    }
  })

  it('リプレイはどの位置からでも4コマ以内に引き込める', () => {
    for (let reel = 0; reel < 3; reel++) {
      for (let cur = 0; cur < STRIP_LENGTH; cur++) {
        expect(findPullIn(reel, cur, 'REPLAY')).not.toBeNull()
      }
    }
  })

  it('ボーナス図柄（STAR）は引き込めない位置がある（目押し要素）', () => {
    for (let reel = 0; reel < 2; reel++) {
      const misses = Array.from({ length: STRIP_LENGTH }, (_, cur) =>
        findPullIn(reel, cur, 'STAR'),
      ).filter((v) => v === null)
      expect(misses.length).toBeGreaterThan(0)
    }
  })
})

describe('停止制御', () => {
  it('ぶどうフラグ時は必ずぶどうが中段に止まる', () => {
    const flag: Flag = { role: 'GRAPE', midCherry: false }
    for (let reel = 0; reel < 3; reel++) {
      for (let cur = 0; cur < STRIP_LENGTH; cur++) {
        const idx = resolveStop(reel, cur, flag, null, [null, null, null])
        expect(symbolAt(reel, idx)).toBe('GRAPE')
      }
    }
  })

  it('すべりは最大4コマ以内', () => {
    const flag: Flag = { role: 'REPLAY', midCherry: false }
    for (let reel = 0; reel < 3; reel++) {
      for (let cur = 0; cur < STRIP_LENGTH; cur++) {
        const idx = resolveStop(reel, cur, flag, null, [null, null, null])
        // 回転方向はindexが減る向きなので、すべり＝cur − idx
        const slip = (cur - idx + STRIP_LENGTH) % STRIP_LENGTH
        expect(slip).toBeLessThanOrEqual(4)
      }
    }
  })

  it('ハズレ時の第1停止はビタ止まり（押した位置で止まる）', () => {
    for (let cur = 0; cur < STRIP_LENGTH; cur++) {
      expect(resolveStop(0, cur, noFlag, null, [null, null, null])).toBe(cur)
    }
  })

  it('左リールBAR狙いならチェリーが滑ってきて止まる（±1コマの押しズレ込み）', () => {
    const flag: Flag = { role: 'CHERRY', midCherry: false }
    const bars = STRIPS[0].flatMap((s, i) => (s === 'BAR' ? [i] : []))
    expect(bars.length).toBeGreaterThan(0)
    for (const bar of bars) {
      for (const d of [-1, 0, 1]) {
        const cur = (bar + d + STRIP_LENGTH) % STRIP_LENGTH
        const idx = resolveStop(0, cur, flag, null, [null, null, null])
        expect(windowSymbols(0, idx)).toContain('CHERRY')
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

  it('ハズレ時に中段が同一図柄で揃わない', () => {
    for (let c0 = 0; c0 < STRIP_LENGTH; c0++) {
      for (let c1 = 0; c1 < STRIP_LENGTH; c1++) {
        const i0 = resolveStop(0, c0, noFlag, null, [null, null, null])
        const s0 = symbolAt(0, i0)
        const i1 = resolveStop(1, c1, noFlag, null, [s0, null, null])
        const s1 = symbolAt(1, i1)
        for (let c2 = 0; c2 < STRIP_LENGTH; c2++) {
          const i2 = resolveStop(2, c2, noFlag, null, [s0, s1, null])
          const s2 = symbolAt(2, i2)
          expect(s0 === s1 && s1 === s2).toBe(false)
        }
      }
    }
  })

  it('ボーナス成立中は届く位置ならボーナス図柄を引き込む（BIG）', () => {
    for (let reel = 0; reel < 3; reel++) {
      for (let cur = 0; cur < STRIP_LENGTH; cur++) {
        const reachable = findPullIn(reel, cur, 'STAR') !== null
        const idx = resolveStop(reel, cur, noFlag, 'BIG', [null, null, null])
        if (reachable) expect(symbolAt(reel, idx)).toBe('STAR')
      }
    }
  })
})

describe('ボーナス図柄判定', () => {
  it('BIG: STAR-STAR-STAR', () => {
    expect(checkBonusAligned(['STAR', 'STAR', 'STAR'], 'BIG')).toBe(true)
    expect(checkBonusAligned(['STAR', 'STAR', 'BAR'], 'BIG')).toBe(false)
  })
  it('REG: STAR-STAR-BAR', () => {
    expect(checkBonusAligned(['STAR', 'STAR', 'BAR'], 'REG')).toBe(true)
    expect(checkBonusAligned(['STAR', 'STAR', 'STAR'], 'REG')).toBe(false)
  })
})
