import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { type ColorKey, denominator, formatRatio } from '../logic/counter'
import { useCounterStore } from '../store'
import { playClick, playMinus, playReset } from '../sfx'

const COLOR_NAMES: Record<ColorKey, string> = {
  white: '白',
  red: '赤',
  green: '緑',
  yellow: '黄',
}

interface Props {
  colorKey: ColorKey
}

/**
 * 4色カウントボタン。カード全体がボタンで、タップ=+1。
 * 実機の「長押しリセット」「▲押しながら減算」は、
 * カード下部の専用ボタン（−1 / リセット2段階確認）に置き換えている。
 * カウントと確率（総回転数÷カウント）は常時同時表示（÷モード切替不要）。
 */
export function CounterCard({ colorKey }: Props) {
  const cell = useCounterStore((s) => s.scenes[s.active].cells[colorKey])
  const games = useCounterStore((s) => s.scenes[s.active].games)
  const prefs = useCounterStore((s) => s.prefs)
  const incrementCell = useCounterStore((s) => s.incrementCell)
  const decrementCell = useCounterStore((s) => s.decrementCell)
  const resetCellCount = useCounterStore((s) => s.resetCellCount)
  const renameCell = useCounterStore((s) => s.renameCell)

  const [flash, setFlash] = useState(false)
  const [armed, setArmed] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const armTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(
    () => () => {
      clearTimeout(flashTimer.current)
      clearTimeout(armTimer.current)
    },
    [],
  )

  const vibrate = (pattern: number | number[]) => {
    if (prefs.vibrate && 'vibrate' in navigator) navigator.vibrate(pattern)
  }

  const onCount = (e: PointerEvent) => {
    // マウスは左ボタンのみ。タッチ/ペンはそのまま受け付ける
    if (e.pointerType === 'mouse' && e.button !== 0) return
    incrementCell(colorKey)
    if (prefs.sound) playClick()
    vibrate(15)
    setFlash(true)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(false), 160)
  }

  const onMinus = (e: PointerEvent) => {
    e.stopPropagation()
    if (cell.count === 0) return
    decrementCell(colorKey)
    if (prefs.sound) playMinus()
    vibrate(8)
  }

  const onReset = (e: PointerEvent) => {
    e.stopPropagation()
    if (!armed) {
      if (cell.count === 0) return
      setArmed(true)
      clearTimeout(armTimer.current)
      armTimer.current = setTimeout(() => setArmed(false), 2000)
      return
    }
    clearTimeout(armTimer.current)
    setArmed(false)
    resetCellCount(colorKey)
    if (prefs.sound) playReset()
    vibrate([20, 40, 20])
  }

  const onRename = (e: PointerEvent) => {
    e.stopPropagation()
    const label = window.prompt(`${COLOR_NAMES[colorKey]}ボタンの役名（10文字まで）`, cell.label)
    if (label !== null && label.trim() !== '') renameCell(colorKey, label.trim())
  }

  return (
    <div
      className={`card card-${colorKey}${flash ? ' is-flash' : ''}`}
      role="button"
      aria-label={`${cell.label}をカウント。現在${cell.count}回`}
      onPointerDown={onCount}
    >
      <button type="button" className="cardLabel" onPointerDown={onRename}>
        {cell.label} <span className="cardLabelEdit" aria-hidden="true">✎</span>
      </button>
      <div className="cardCount">{cell.count.toLocaleString()}</div>
      <div className="cardRatio">{formatRatio(denominator(games, cell.count))}</div>
      <div className="cardActions">
        <button
          type="button"
          className="cardBtn"
          onPointerDown={onMinus}
          disabled={cell.count === 0}
          aria-label={`${cell.label}を1減らす`}
        >
          −1
        </button>
        <button
          type="button"
          className={`cardBtn cardBtn-reset${armed ? ' is-armed' : ''}`}
          onPointerDown={onReset}
          disabled={cell.count === 0 && !armed}
          aria-label={`${cell.label}のカウントをリセット`}
        >
          {armed ? 'もう一度で確定' : 'リセット'}
        </button>
      </div>
    </div>
  )
}
