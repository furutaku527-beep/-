import { useState } from 'react'
import { useCounterStore } from '../store'

const STEPS = [1, 10, 100, 1000] as const

/**
 * 総回転数の入力パネル。
 * 実機は黒■▲ボタンでの桁入力だが、アプリではステップボタン
 * （±1/10/100/1000）と数値直接入力に置き換えて使いやすくする。
 */
export function GamesPanel() {
  const games = useCounterStore((s) => s.scenes[s.active].games)
  const setGamesValue = useCounterStore((s) => s.setGamesValue)
  const addGamesValue = useCounterStore((s) => s.addGamesValue)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [minusMode, setMinusMode] = useState(false)

  const commit = () => {
    setEditing(false)
    if (draft.trim() === '') return
    const n = Number(draft)
    if (Number.isFinite(n)) setGamesValue(n)
  }

  return (
    <section className="gamesPanel" aria-label="総回転数">
      <div className="gamesRow">
        <span className="gamesLabel">総回転数</span>
        {editing ? (
          <input
            className="gamesInput"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') setEditing(false)
            }}
            aria-label="総回転数を直接入力"
          />
        ) : (
          <button
            type="button"
            className="gamesValue"
            onClick={() => {
              setDraft(String(games || ''))
              setEditing(true)
            }}
            aria-label={`総回転数 ${games}。タップで直接入力`}
          >
            {games.toLocaleString()}
            <span className="gamesUnit">G</span>
          </button>
        )}
      </div>
      <div className="gamesButtons">
        <button
          type="button"
          className={`stepBtn signBtn${minusMode ? ' is-minus' : ''}`}
          onClick={() => setMinusMode((m) => !m)}
          aria-pressed={minusMode}
          aria-label="減算モード切替"
        >
          {minusMode ? '−' : '＋'}
        </button>
        {STEPS.map((step) => (
          <button
            key={step}
            type="button"
            className="stepBtn"
            onClick={() => addGamesValue(minusMode ? -step : step)}
          >
            {minusMode ? '−' : '+'}
            {step.toLocaleString()}
          </button>
        ))}
      </div>
    </section>
  )
}
