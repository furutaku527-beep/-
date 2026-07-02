import { useGameStore } from '../state/gameStore'
import styles from './NotifyLamp.module.css'

/** 告知ランプ（オリジナルデザイン）。点灯したらボーナスを揃えるまで消えない */
export function NotifyLamp() {
  const lamp = useGameStore((s) => s.lamp)
  const inBonus = useGameStore((s) => s.inBonus)

  const cls =
    lamp === 'rainbow'
      ? `${styles.lamp} ${styles.rainbow}`
      : lamp === 'on' || inBonus
        ? `${styles.lamp} ${styles.on}`
        : styles.lamp

  return (
    <div className={styles.wrap}>
      <div className={cls}>
        <span className={styles.face}>✦</span>
      </div>
      <div className={styles.label}>PIKA LAMP</div>
    </div>
  )
}
