import { useGameStore } from '../state/gameStore'
import { useStatsStore } from '../state/statsStore'
import styles from './CreditDisplay.module.css'

export function CreditDisplay() {
  const credits = useGameStore((s) => s.credits)
  const lastPayout = useGameStore((s) => s.lastPayout)
  const inBonus = useGameStore((s) => s.inBonus)
  const bonusGamesLeft = useGameStore((s) => s.bonusGamesLeft)
  const message = useGameStore((s) => s.message)
  const diff = useStatsStore((s) => s.diff)

  return (
    <div className={styles.row}>
      <div className={styles.box}>
        <div className={styles.label}>CREDIT</div>
        <div className={styles.value}>{credits}</div>
      </div>
      <div className={styles.center}>
        {inBonus ? (
          <div className={`${styles.msg} ${inBonus === 'BIG' ? styles.big : styles.reg}`}>
            {inBonus} 残り{bonusGamesLeft}G
          </div>
        ) : message ? (
          <div className={styles.msg}>{message}</div>
        ) : (
          <div className={styles.diff}>差枚 {diff >= 0 ? '+' : ''}{diff}</div>
        )}
      </div>
      <div className={styles.box}>
        <div className={styles.label}>WIN</div>
        <div className={styles.value}>{lastPayout || '-'}</div>
      </div>
    </div>
  )
}
