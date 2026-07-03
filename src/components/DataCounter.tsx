import { useStatsStore } from '../state/statsStore'
import { SlumpGraph } from './SlumpGraph'
import styles from './Panels.module.css'

/** 実機風データカウンター：BIG/REG回数・現在ゲーム数・当たり履歴・スランプグラフ */
export function DataCounter() {
  const bigCount = useStatsStore((s) => s.bigCount)
  const regCount = useStatsStore((s) => s.regCount)
  const totalGames = useStatsStore((s) => s.totalGames)
  const gamesSinceBonus = useStatsStore((s) => s.gamesSinceBonus)
  const history = useStatsStore((s) => s.history)

  return (
    <div className={styles.panel}>
      <div className={styles.title}>DATA COUNTER</div>
      <div className={styles.counterRow}>
        <div className={styles.counterBox}>
          <div className={styles.counterLabel}>BIG</div>
          <div className={`${styles.counterValue} ${styles.bigColor}`}>{bigCount}</div>
        </div>
        <div className={styles.counterBox}>
          <div className={styles.counterLabel}>REG</div>
          <div className={`${styles.counterValue} ${styles.regColor}`}>{regCount}</div>
        </div>
        <div className={styles.counterBox}>
          <div className={styles.counterLabel}>現在G</div>
          <div className={styles.counterValue}>{gamesSinceBonus}</div>
        </div>
        <div className={styles.counterBox}>
          <div className={styles.counterLabel}>累計G</div>
          <div className={styles.counterValue}>{totalGames}</div>
        </div>
      </div>
      <SlumpGraph />
      {history.length > 0 && (
        <div className={styles.historyList}>
          {history.map((h, i) => (
            <div key={h.at + '-' + i} className={styles.historyItem}>
              <span className={`${styles.badge} ${h.kind === 'BIG' ? styles.badgeBig : styles.badgeReg}`}>
                {h.kind}
              </span>
              <span>{h.premium ? '🌈 ' : ''}{h.games}G</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
