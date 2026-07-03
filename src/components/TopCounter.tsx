import { useStatsStore } from '../state/statsStore'
import styles from './TopCounter.module.css'

/** 筐体上に常設するホール設置型データカウンター風の表示 */
export function TopCounter() {
  const bigCount = useStatsStore((s) => s.bigCount)
  const regCount = useStatsStore((s) => s.regCount)
  const gamesSinceBonus = useStatsStore((s) => s.gamesSinceBonus)
  const totalGames = useStatsStore((s) => s.totalGames)

  return (
    <div className={styles.counter}>
      <div className={styles.item}>
        <span className={styles.label}>BIG</span>
        <span className={`${styles.digits} ${styles.big}`}>{String(bigCount).padStart(3, '0')}</span>
      </div>
      <div className={styles.item}>
        <span className={styles.label}>REG</span>
        <span className={`${styles.digits} ${styles.reg}`}>{String(regCount).padStart(3, '0')}</span>
      </div>
      <div className={styles.item}>
        <span className={styles.label}>回転数</span>
        <span className={styles.digits}>{String(gamesSinceBonus).padStart(4, '0')}</span>
      </div>
      <div className={styles.item}>
        <span className={styles.label}>総回転</span>
        <span className={styles.digits}>{String(totalGames).padStart(5, '0')}</span>
      </div>
    </div>
  )
}
