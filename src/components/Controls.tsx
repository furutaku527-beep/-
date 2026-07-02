import { BET } from '../game/payouts'
import { kickAuto, useGameStore } from '../state/gameStore'
import styles from './Controls.module.css'

export function Controls() {
  const reels = useGameStore((s) => s.reels)
  const startSpin = useGameStore((s) => s.startSpin)
  const stopReel = useGameStore((s) => s.stopReel)
  const auto = useGameStore((s) => s.auto)
  const setAuto = useGameStore((s) => s.setAuto)
  const muted = useGameStore((s) => s.muted)
  const toggleMute = useGameStore((s) => s.toggleMute)
  const credits = useGameStore((s) => s.credits)
  const replayNext = useGameStore((s) => s.replayNext)
  const addCredits = useGameStore((s) => s.addCredits)

  const anySpinning = reels.some((r) => r.spinning)
  const canStart = !anySpinning && (replayNext || credits >= BET)
  const broke = !anySpinning && !replayNext && credits < BET

  const toggleAuto = () => {
    const next = !auto
    setAuto(next)
    if (next) kickAuto()
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.stopRow}>
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            className={styles.stopBtn}
            disabled={!reels[i].spinning || auto}
            onClick={() => stopReel(i)}
          >
            STOP
          </button>
        ))}
      </div>
      <div className={styles.mainRow}>
        <button
          className={`${styles.sideBtn} ${auto ? styles.sideActive : ''}`}
          onClick={toggleAuto}
        >
          AUTO
        </button>
        <button
          className={styles.startBtn}
          disabled={!canStart || auto}
          onClick={startSpin}
        >
          {replayNext ? 'REPLAY' : 'START'}
        </button>
        <button className={styles.sideBtn} onClick={toggleMute}>
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
      {broke && (
        <button className={styles.refill} onClick={() => addCredits(500)}>
          コイン切れ！ +500枚 補充する
        </button>
      )}
    </div>
  )
}
