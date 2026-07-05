import { useGameStore } from '../state/gameStore'
import { Reel } from './Reel'
import styles from './ReelSet.module.css'

export function ReelSet() {
  const anySpinning = useGameStore((s) => s.reels.some((r) => r.spinning))
  const lastPayout = useGameStore((s) => s.lastPayout)
  const win = !anySpinning && lastPayout > 0

  return (
    <div className={styles.bezel}>
      <div className={`${styles.set} ${win ? styles.win : ''}`}>
        <Reel reel={0} />
        <Reel reel={1} />
        <Reel reel={2} />
      </div>
    </div>
  )
}
