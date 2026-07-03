import { useEffect, useRef, useState } from 'react'
import { STRIP_LENGTH, symbolAt } from '../game/reels'
import { KOMA_MS, useGameStore } from '../state/gameStore'
import { SlotSymbol } from './symbols'
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
  const posRef = useRef(pos)
  posRef.current = pos

  useEffect(() => {
    let raf = 0

    if (spinning) {
      // 等速回転（実機の約75〜80rpm相当）。実機同様、図柄は上から下へ流れる
      const base = index
      const loop = () => {
        const elapsed = Date.now() - spinStartAt
        setPos(base - elapsed / KOMA_MS)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
      return () => cancelAnimationFrame(raf)
    }

    // 停止指示後：見えている位置から停止位置まで回転方向のまま滑って止まる。
    // すべり0（ビタ）なら残りの端数だけ整列してその場で止まり、
    // 引き込みがあるときだけ最大4コマのすべりが見える（実機の挙動）。
    const cur = posRef.current
    let travel = (((cur - index) % STRIP_LENGTH) + STRIP_LENGTH) % STRIP_LENGTH
    // コマ内の端数によるほぼ一周分の巻き込みはビタ止まり（半コマ未満の戻し）として扱う
    if (travel > STRIP_LENGTH - 1) travel -= STRIP_LENGTH
    if (Math.abs(travel) < 0.02) {
      setPos(index)
      return
    }
    const startPos = cur
    const startT = performance.now()
    const duration = Math.max(40, Math.abs(travel) * KOMA_MS)
    const loop = (t: number) => {
      const k = Math.min(1, (t - startT) / duration)
      setPos(startPos - travel * k)
      if (k < 1) {
        raf = requestAnimationFrame(loop)
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
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
            <SlotSymbol symbol={symbol} />
          </div>
        ))}
      </div>
      <div className={styles.payline} />
      <div className={styles.glass} />
    </div>
  )
}
