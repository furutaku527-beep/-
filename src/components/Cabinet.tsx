import { useLayoutEffect, useRef, useState } from 'react'
import { BET } from '../game/payouts'
import { kickAuto, useGameStore } from '../state/gameStore'
import { useStatsStore } from '../state/statsStore'
import { NotifyLamp } from './NotifyLamp'
import { ReelSet } from './ReelSet'
import cabinetUrl from '../assets/cabinet.webp'
import styles from './Cabinet.module.css'

/** 内部設計サイズ（この座標系で組み、幅に合わせて等倍スケールする） */
const DW = 400
const DH = 1023

const DEBUG = false
const MEASURE = false

/** px 指定の矩形を design 座標のスタイルに変換 */
function box(left: number, top: number, width: number, height: number): React.CSSProperties {
  return { left, top, width, height }
}

export function Cabinet({ onNameTap }: { onNameTap?: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      setScale(w / DW)
    })
    ro.observe(el)
    setScale(el.clientWidth / DW)
    return () => ro.disconnect()
  }, [])

  // --- 状態 ---
  const reels = useGameStore((s) => s.reels)
  const credits = useGameStore((s) => s.credits)
  const lastPayout = useGameStore((s) => s.lastPayout)
  const bet = useGameStore((s) => s.bet)
  const betPlaced = useGameStore((s) => s.betPlaced)
  const waiting = useGameStore((s) => s.waiting)
  const settling = useGameStore((s) => s.settling)
  const replayNext = useGameStore((s) => s.replayNext)
  const inBonus = useGameStore((s) => s.inBonus)
  const auto = useGameStore((s) => s.auto)
  const muted = useGameStore((s) => s.muted)
  const reelSpeedPct = useGameStore((s) => s.reelSpeedPct)

  const betMax = useGameStore((s) => s.betMax)
  const bet1 = useGameStore((s) => s.bet1)
  const startSpin = useGameStore((s) => s.startSpin)
  const stopReel = useGameStore((s) => s.stopReel)
  const setAuto = useGameStore((s) => s.setAuto)
  const setReelSpeed = useGameStore((s) => s.setReelSpeed)
  const toggleMute = useGameStore((s) => s.toggleMute)

  const bigCount = useStatsStore((s) => s.bigCount)
  const regCount = useStatsStore((s) => s.regCount)
  const gamesSinceBonus = useStatsStore((s) => s.gamesSinceBonus)
  const totalGames = useStatsStore((s) => s.totalGames)
  const diff = useStatsStore((s) => s.diff)

  const anySpinning = reels.some((r) => r.spinning)
  const betIdle = !anySpinning && !waiting && !settling && !replayNext
  const current = betPlaced ? bet : 0
  const canBetMax = betIdle && current !== BET && credits >= BET - current
  const canBet1 = betIdle && current !== 1 && !inBonus && credits >= Math.max(0, 1 - current)
  const canLever = !anySpinning && !waiting && !settling && betPlaced

  const [pulled, setPulled] = useState(false)
  const lever = () => {
    if (auto || !canLever) return
    setPulled(true)
    setTimeout(() => setPulled(false), 200)
    startSpin()
  }
  const toggleAuto = () => {
    const n = !auto
    setAuto(n)
    if (n) kickAuto()
  }
  const cycleSpeed = () => {
    const S = [100, 70, 50]
    setReelSpeed(S[(S.indexOf(reelSpeedPct) + 1) % S.length] ?? 100)
  }

  const dbg = DEBUG ? ` ${styles.debug}` : ''
  const pad = (n: number, w: number) => String(n).padStart(w, '0')

  return (
    <div ref={wrapRef} className={styles.wrap} style={{ height: DH * scale }}>
      <div className={styles.design} style={{ transform: `scale(${scale})`, ['--cab-bg' as string]: `url(${cabinetUrl})` }}>
        {MEASURE &&
          [140, 160, 180, 200, 500, 520, 540, 560, 920, 940, 960, 980].map((y) => (
            <div key={'h' + y} style={{ position: 'absolute', left: 0, top: y, width: 400, height: 1, background: y % 40 === 0 ? '#0ff' : 'rgba(0,255,255,0.5)' }}>
              <span style={{ position: 'absolute', left: 0, top: -9, fontSize: 8, color: '#0ff' }}>{y}</span>
            </div>
          ))}
        {MEASURE &&
          [40, 80, 120, 160, 200, 240, 280, 320, 360].map((x) => (
            <div key={'v' + x} style={{ position: 'absolute', top: 130, left: x, width: 1, height: 880, background: 'rgba(255,0,255,0.4)' }}>
              <span style={{ position: 'absolute', top: 0, left: 1, fontSize: 8, color: '#f0f' }}>{x}</span>
            </div>
          ))}
        {/* 上部マーキーのアプリ名プレート */}
        <div className={`${styles.o} ${styles.namePlate}`} style={box(8, 44, 286, 66)} onClick={onNameTap}>
          ピカピカ
        </div>

        {/* 上部データカウンター（実データ） */}
        {(
          [
            [pad(bigCount, 3), styles.big, 36, 62],
            [pad(regCount, 3), styles.reg, 114, 64],
            [pad(gamesSinceBonus, 4), styles.green, 188, 82],
            [pad(totalGames, 5), styles.green, 276, 92],
          ] as const
        ).map(([val, cls, left, width], i) => (
          <div
            key={i}
            className={`${styles.o} ${styles.led} ${styles.ledCounter} ${cls}${dbg}`}
            style={{ ...box(left, 162, width, 36), fontSize: 22 }}
          >
            {val}
          </div>
        ))}

        {/* GOGOランプ（GOOD LUCK CHANCE パネル上に重ねる） */}
        <div className={`${styles.o} ${styles.lampBox}${dbg}`} style={box(104, 198, 192, 134)}>
          <NotifyLamp />
        </div>

        {/* リール（金枠内にはめ込む） */}
        <div className={`${styles.o} ${styles.reelSlot}${dbg}`} style={box(58, 352, 288, 156)}>
          <ReelSet bare itemH={52} winW={94} gap={3} />
        </div>

        {/* CREDIT / COUNT / PAYOUT（実データ） */}
        {(
          [
            [String(credits), styles.red, 58, 68],
            [String(gamesSinceBonus), styles.amber, 158, 66],
            [String(lastPayout || 0), styles.green, 238, 56],
          ] as const
        ).map(([val, cls, left, width], i) => (
          <div
            key={i}
            className={`${styles.o} ${styles.led} ${styles.ledCounter} ${cls}${dbg}`}
            style={{ ...box(left, 520, width, 32), fontSize: 20 }}
          >
            {val}
          </div>
        ))}

        {/* レバー（左の黒い丸ノブ） */}
        <button
          className={`${styles.btn} ${styles.btnRound} ${canLever && !auto ? styles.leverReady : ''} ${pulled ? styles.on : ''}${dbg}`}
          style={box(24, 562, 44, 44)}
          disabled={!canLever || auto}
          onPointerDown={lever}
          aria-label="レバー"
        />

        {/* STOP ×3（丸ボタン） */}
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            className={`${styles.btn} ${styles.btnRound}${dbg}`}
            style={box(113 + i * 56, 566, 44, 44)}
            disabled={!reels[i].spinning || auto}
            onPointerDown={(e) => stopReel(i, e.timeStamp)}
            aria-label="STOP"
          />
        ))}

        {/* 下段ボタン列1：1BET / MAXBET / リプレイ / ウェイト / スタート / ボーナス */}
        {(
          [
            ['1bet', 30, 54, () => bet1(), !canBet1 || auto],
            ['max', 88, 54, () => betMax(), !canBetMax || auto],
            ['replay', 148, 52, lever, !canLever || auto],
            ['wait', 206, 52, () => {}, true],
            ['start', 262, 52, lever, !canLever || auto],
            ['bonus', 320, 54, () => {}, true],
          ] as const
        ).map(([key, left, width, fn, disabled]) => (
          <button
            key={key}
            className={`${styles.btn}${dbg}`}
            style={box(left, 812, width, 42)}
            disabled={disabled}
            onPointerDown={() => fn()}
            aria-label={key}
          />
        ))}

        {/* 下段ボタン列2：AUTO / 速度変更 / ♪ON */}
        <button
          className={`${styles.btn} ${auto ? styles.on : ''}${dbg}`}
          style={box(52, 884, 78, 54)}
          onPointerDown={toggleAuto}
          aria-label="AUTO"
        />
        <button
          className={`${styles.btn} ${reelSpeedPct < 100 ? styles.on : ''}${dbg}`}
          style={box(156, 884, 78, 54)}
          onPointerDown={cycleSpeed}
          aria-label="速度変更"
        />
        <button
          className={`${styles.btn} ${!muted ? styles.on : ''}${dbg}`}
          style={box(262, 884, 78, 54)}
          onPointerDown={toggleMute}
          aria-label="サウンド"
        />

        {/* 最下部 CREDIT / 差枚 / WIN（実データ・黒帯なので黒背景で下地を隠す） */}
        <div className={`${styles.o} ${styles.led} ${styles.red} ${styles.bottomCover}${dbg}`} style={{ ...box(24, 958, 92, 40), fontSize: 27 }}>
          {credits}
        </div>
        <div className={`${styles.o} ${styles.bottomCover}${dbg}`} style={{ ...box(132, 948, 126, 34), color: '#b9b3c8', fontSize: 13 }}>
          差枚 {diff >= 0 ? '+' : ''}
          {diff}
        </div>
        <div className={`${styles.o} ${styles.led} ${styles.green} ${styles.bottomCover}${dbg}`} style={{ ...box(282, 958, 74, 40), fontSize: 27 }}>
          {lastPayout || 0}
        </div>
      </div>
    </div>
  )
}
