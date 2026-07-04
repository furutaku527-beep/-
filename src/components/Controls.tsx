import { useState } from 'react'
import { BET } from '../game/payouts'
import { kickAuto, useGameStore } from '../state/gameStore'
import styles from './Controls.module.css'

export function Controls() {
  const reels = useGameStore((s) => s.reels)
  const betPlaced = useGameStore((s) => s.betPlaced)
  const bet = useGameStore((s) => s.bet)
  const waiting = useGameStore((s) => s.waiting)
  const settling = useGameStore((s) => s.settling)
  const betMax = useGameStore((s) => s.betMax)
  const bet1 = useGameStore((s) => s.bet1)
  const startSpin = useGameStore((s) => s.startSpin)
  const stopReel = useGameStore((s) => s.stopReel)
  const auto = useGameStore((s) => s.auto)
  const setAuto = useGameStore((s) => s.setAuto)
  const muted = useGameStore((s) => s.muted)
  const toggleMute = useGameStore((s) => s.toggleMute)
  const credits = useGameStore((s) => s.credits)
  const replayNext = useGameStore((s) => s.replayNext)
  const inBonus = useGameStore((s) => s.inBonus)
  const addCredits = useGameStore((s) => s.addCredits)
  const [pulled, setPulled] = useState(false)

  const anySpinning = reels.some((r) => r.spinning)
  const betIdle = !anySpinning && !waiting && !settling && !replayNext
  // 投入済み枚数（前ゲームのbet残り値は投入済みではない）
  const current = betPlaced ? bet : 0
  const canBetMax = betIdle && current !== BET && credits >= BET - current
  const canBet1 = betIdle && current !== 1 && !inBonus && credits >= Math.max(0, 1 - current)
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
        {/* 左：1BET・MAX BET＋レバー（実機の配置） */}
        <div className={styles.leftCol}>
          <button className={styles.bet1Btn} disabled={!canBet1 || auto} onClick={bet1}>
            1 BET
          </button>
          <button className={styles.betBtn} disabled={!canBetMax || auto} onClick={betMax}>
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
                onPointerDown={() => stopReel(i)}
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
