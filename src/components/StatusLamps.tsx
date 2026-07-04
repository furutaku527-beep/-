import { useGameStore } from '../state/gameStore'
import styles from './StatusLamps.module.css'

/** 実機の下パネル風ステータスランプ（BET・リプレイ・ウェイト・スタート） */
export function StatusLamps() {
  const betPlaced = useGameStore((s) => s.betPlaced)
  const bet = useGameStore((s) => s.bet)
  const waiting = useGameStore((s) => s.waiting)
  const replayNext = useGameStore((s) => s.replayNext)
  const anySpinning = useGameStore((s) => s.reels.some((r) => r.spinning))
  const inBonus = useGameStore((s) => s.inBonus)

  const betLit = betPlaced || anySpinning || waiting
  const startLit = betPlaced && !anySpinning && !waiting

  return (
    <div className={styles.row}>
      <div className={styles.betGroup}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={`${styles.betDot} ${betLit && n <= bet ? styles.lit : ''}`}>
            {n}
          </span>
        ))}
        <span className={styles.groupLabel}>BET</span>
      </div>
      <span className={`${styles.lamp} ${styles.replay} ${replayNext ? styles.lit : ''}`}>
        REPLAY
      </span>
      <span className={`${styles.lamp} ${styles.wait} ${waiting ? styles.lit : ''}`}>WAIT</span>
      <span className={`${styles.lamp} ${styles.start} ${startLit ? styles.lit : ''}`}>START</span>
      <span className={`${styles.lamp} ${styles.bonus} ${inBonus ? styles.lit : ''}`}>BONUS</span>
    </div>
  )
}
