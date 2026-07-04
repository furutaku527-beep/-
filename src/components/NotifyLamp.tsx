import { useGameStore } from '../state/gameStore'
import offUrl from '../assets/gogo-off.png'
import onUrl from '../assets/gogo-on.png'
import styles from './NotifyLamp.module.css'

// 点灯が一瞬でも遅れないよう先読みしておく
if (typeof window !== 'undefined') {
  for (const src of [offUrl, onUrl]) {
    const img = new Image()
    img.src = src
  }
}

/**
 * 告知ランプ（GOGO! CHANCE）。
 * 実機同様、点灯したら消えずに光り続ける。点灯の瞬間だけ僅かに弾む。
 * プレミアム時は色相が回るレインボー発光。
 */
export function NotifyLamp() {
  const lamp = useGameStore((s) => s.lamp)
  const inBonus = useGameStore((s) => s.inBonus)

  const lit = lamp !== 'off' || inBonus !== null
  const rainbow = lamp === 'rainbow'

  return (
    <div className={styles.wrap}>
      {lit && <div className={styles.halo} />}
      <img src={offUrl} className={styles.off} alt="" draggable={false} />
      <img
        src={onUrl}
        className={`${styles.on} ${lit ? styles.lit : ''} ${rainbow ? styles.rainbow : ''}`}
        alt="GOGO! CHANCE"
        draggable={false}
      />
    </div>
  )
}
