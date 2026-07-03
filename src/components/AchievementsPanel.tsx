import { ACHIEVEMENTS, useAchievementsStore } from '../state/achievementsStore'
import styles from './Panels.module.css'

export function AchievementsPanel() {
  const unlocked = useAchievementsStore((s) => s.unlocked)
  const count = Object.keys(unlocked).length

  return (
    <div className={styles.panel}>
      <div className={styles.title}>
        実績 {count}/{ACHIEVEMENTS.length}
      </div>
      <div className={styles.achGrid}>
        {ACHIEVEMENTS.map((a) => {
          const isUnlocked = Boolean(unlocked[a.id])
          return (
            <div key={a.id} className={`${styles.achItem} ${isUnlocked ? '' : styles.achLocked}`}>
              <span className={styles.achIcon}>{a.icon}</span>
              <div>
                <div className={styles.achTitle}>{a.title}</div>
                <div className={styles.achDesc}>{a.desc}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
