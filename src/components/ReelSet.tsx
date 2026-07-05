import { useGameStore } from '../state/gameStore'
import { Reel } from './Reel'
import styles from './ReelSet.module.css'

interface Props {
  /** 1コマ高さ(px)。既定64 */
  itemH?: number
  /** 表示窓の幅(px)。既定82 */
  winW?: number
  /** リール間の隙間(px)。既定7 */
  gap?: number
  /** クロームの縁取りを外して枠内にはめ込む用（筐体スキン用） */
  bare?: boolean
}

export function ReelSet({ itemH, winW, gap = 7, bare = false }: Props) {
  const anySpinning = useGameStore((s) => s.reels.some((r) => r.spinning))
  const lastPayout = useGameStore((s) => s.lastPayout)
  const win = !anySpinning && lastPayout > 0

  const set = (
    <div className={`${styles.set} ${win ? styles.win : ''} ${bare ? styles.bareSet : ''}`} style={{ gap }}>
      <Reel reel={0} itemH={itemH} winW={winW} />
      <Reel reel={1} itemH={itemH} winW={winW} />
      <Reel reel={2} itemH={itemH} winW={winW} />
    </div>
  )

  if (bare) return set
  return <div className={styles.bezel}>{set}</div>
}
