import { useEffect, useRef, useState } from 'react'
import { STRIP_LENGTH, SYMBOL_ICONS, symbolAt } from '../game/reels'
import { KOMA_MS, useGameStore } from '../state/gameStore'
import styles from './Reel.module.css'

const ITEM_H = 64 // px

interface Props {
  reel: number
}

export function Reel({ reel }: Props) {
  const spinning = useGameStore((s) => s.reels[reel].spinning)
  const index = useGameStore((s) => s.reels[reel].index)
  const spinStartAt = useGameStore((s) => s.spinStartAt)
  const [pos, setPos] = useState<number>(index)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!spinning) {
      setPos(index)
      return
    }
    const loop = () => {
      const elapsed = Date.now() - spinStartAt
      setPos(index + elapsed / KOMA_MS)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [spinning, index, spinStartAt])

  const base = Math.floor(pos)
  const frac = pos - base
  // 表示窓は3コマ。上から base-1, base, base+1 を表示し、frac 分だけ上へスクロール
  const items = [-1, 0, 1, 2].map((k) => {
    const idx = (((base + k) % STRIP_LENGTH) + STRIP_LENGTH) % STRIP_LENGTH
    return { key: k, symbol: symbolAt(reel, idx) }
  })

  return (
    <div className={styles.window} style={{ height: ITEM_H * 3 }}>
      <div
        className={`${styles.strip} ${spinning ? styles.spinning : ''}`}
        style={{ transform: `translateY(${-frac * ITEM_H}px)` }}
      >
        {items.map(({ key, symbol }) => (
          <div key={key} className={styles.cell} style={{ height: ITEM_H }}>
            {SYMBOL_ICONS[symbol]}
          </div>
        ))}
      </div>
      <div className={styles.payline} />
    </div>
  )
}
