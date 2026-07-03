import { useEffect, useMemo, useRef } from 'react'
import { STRIP_LENGTH, symbolAt } from '../game/reels'
import { KOMA_MS, useGameStore } from '../state/gameStore'
import { SlotSymbol } from './symbols'
import styles from './Reel.module.css'

const ITEM_H = 64 // px
/** 巻き付き表示用にストリップを3周分描画する（中央の周を表示に使う） */
const COPIES = 3

interface Props {
  reel: number
}

/**
 * リール1本。回転は React の再レンダリングを介さず transform だけを
 * requestAnimationFrame で直接更新する（目押しのための滑らかさ優先）。
 */
export function Reel({ reel }: Props) {
  const spinning = useGameStore((s) => s.reels[reel].spinning)
  const index = useGameStore((s) => s.reels[reel].index)
  const spinStartAt = useGameStore((s) => s.spinStartAt)
  const winCells = useGameStore((s) => s.winCells)
  const winRows = [...new Set(winCells.filter(([r]) => r === reel).map(([, row]) => row))]

  const stripRef = useRef<HTMLDivElement>(null)
  const posRef = useRef<number>(index)

  // 図柄セルは不変なので一度だけ生成する（3周分）
  const cells = useMemo(() => {
    const out: { key: number; idx: number }[] = []
    for (let c = 0; c < COPIES; c++) {
      for (let i = 0; i < STRIP_LENGTH; i++) out.push({ key: c * STRIP_LENGTH + i, idx: i })
    }
    return out
  }, [])

  useEffect(() => {
    let raf = 0
    const apply = (p: number) => {
      const pos = ((p % STRIP_LENGTH) + STRIP_LENGTH) % STRIP_LENGTH
      posRef.current = pos
      const el = stripRef.current
      // 中央コピーの cell(pos) が中段に来るよう配置
      if (el) el.style.transform = `translate3d(0, ${(-(pos + STRIP_LENGTH - 1) * ITEM_H).toFixed(2)}px, 0)`
    }

    if (spinning) {
      // 等速回転（0.78秒/周）。実機同様、図柄は上から下へ流れる
      const base = index
      const loop = () => {
        const elapsed = Date.now() - spinStartAt
        apply(base - elapsed / KOMA_MS)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
      return () => cancelAnimationFrame(raf)
    }

    // 停止指示後：見えている位置から停止位置まで回転方向のまま滑って止まる。
    // すべり0（ビタ）なら残りの端数だけ整列してその場で止まる。
    const cur = posRef.current
    let travel = (((cur - index) % STRIP_LENGTH) + STRIP_LENGTH) % STRIP_LENGTH
    if (travel > STRIP_LENGTH - 1) travel -= STRIP_LENGTH
    if (Math.abs(travel) < 0.02) {
      apply(index)
      return
    }
    const startPos = cur
    const startT = performance.now()
    const duration = Math.max(40, Math.abs(travel) * KOMA_MS)
    const loop = (t: number) => {
      const k = Math.min(1, (t - startT) / duration)
      apply(startPos - travel * k)
      if (k < 1) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [spinning, index, spinStartAt])

  return (
    <div className={styles.window} style={{ height: ITEM_H * 3 }}>
      <div ref={stripRef} className={styles.strip}>
        {cells.map(({ key, idx }) => (
          <div key={key} className={styles.cell} style={{ height: ITEM_H }}>
            <SlotSymbol symbol={symbolAt(reel, idx)} />
          </div>
        ))}
      </div>
      {!spinning &&
        winRows.map((row) => (
          <div key={row} className={styles.winRow} style={{ top: (row + 1) * ITEM_H }} />
        ))}
      <div className={styles.payline} />
      <div className={styles.glass} />
    </div>
  )
}
