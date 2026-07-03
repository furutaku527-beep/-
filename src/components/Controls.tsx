import { useState } from 'react'
import { BET } from '../game/payouts'
import { kickAuto, useGameStore } from '../state/gameStore'
import styles from './Controls.module.css'

export function Controls() {
  const reels = useGameStore((s) => s.reels)
  const betPlaced = useGameStore((s) => s.betPlaced)
  const waiting = useGameStore((s) => s.waiting)
  const settling = useGameStore((s) => s.settling)
  const betMax = useGameStore((s) => s.betMax)
  const startSpin = useGameStore((s) => s.startSpin)
  const stopReel = useGameStore((s) => s.stopReel)
  const auto = useGameStore((s) => s.auto)
  const setAuto = useGameStore((s) => s.setAuto)
  const muted = useGameStore((s) => s.muted)
  const toggleMute = useGameStore((s) => s.toggleMute)
  const credits = useGameStore((s) => s.credits)
  const replayNext = useGameStore((s) => s.replayNext)
  const addCredits = useGameStore((s) => s.addCredits)
  const [pulled, setPulled] = useState(false)

  const anySpinning = reels.some((r) => r.spinning)
  const canBet = !anySpinning && !waiting && !settling && !betPlaced && !replayNext && credits >= BET
  const canLever = !anySpinning && !waiting && !settling && betPlaced
  const broke = !anySpinning && !betPlaced && !replayNext && !waiting && !settling && credits < BET

  const pullLever = () => {
    if (auto) return
    setPulled(true)
    setTimeout(() => setPulled(false), 220)
    startSpin()
  }

  const toggleAuto = () => {
    const next = !auto
    setAuto(next)
    if (next) kickAuto()
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.mainArea}>
        {/* 左：MAX BET＋レバー（実機の配置） */}
        <div className={styles.leftCol}>
          <button className={styles.betBtn} disabled={!canBet || auto} onClick={betMax}>
            MAX
            <br />
            BET
          </button>
          <div
            className={`${styles.lever} ${pulled ? styles.pulled : ''} ${canLever && !auto ? styles.leverReady : ''}`}
            onPointerDown={pullLever}
            role="button"
            aria-label="レバー"
          >
            <div className={styles.leverKnob} />
            <div className={styles.leverStick} />
            <div className={styles.leverBase} />
          </div>
        </div>

        {/* 右：ストップボタン＋サブ操作 */}
        <div className={styles.rightCol}>
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
          <div className={styles.subRow}>
            <button
              className={`${styles.sideBtn} ${auto ? styles.sideActive : ''}`}
              onClick={toggleAuto}
            >
              AUTO
            </button>
            <button className={styles.sideBtn} onClick={toggleMute}>
              {muted ? '♪ OFF' : '♪ ON'}
            </button>
          </div>
        </div>
      </div>

      {broke && (
        <button className={styles.refill} onClick={() => addCredits(500)}>
          コイン切れ！ +500枚 補充する
        </button>
      )}
    </div>
  )
}
