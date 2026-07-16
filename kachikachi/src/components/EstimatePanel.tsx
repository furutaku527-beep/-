import { useState } from 'react'
import {
  type BonusData,
  type HintGroup,
  type LampColor,
  LAMP_COLORS,
  COLOR_KEYS,
  denominator,
  formatRatio,
} from '../logic/counter'
import { BIG_GAMES, estimateSettings } from '../logic/tensho'
import { useCounterStore } from '../store'
import { playClick, playMinus } from '../sfx'

const LAMP_NAMES: Record<LampColor, string> = {
  blue: '青',
  green: '緑',
  yellow: '黄',
  red: '赤',
  rainbow: '虹',
}

const BONUS_ITEMS: { key: keyof BonusData; label: string }[] = [
  { key: 'big', label: 'BIG' },
  { key: 'reg', label: 'REG' },
  { key: 'bigSuika', label: 'BIG中スイカ' },
]

const HINT_SECTIONS: { group: HintGroup; title: string; caption: string }[] = [
  {
    group: 'side',
    title: 'REG中サイドランプ',
    caption: '左リール中段に白7ビタでスイカ成立時。青緑=奇数・黄赤=偶数・虹=高設定示唆',
  },
  {
    group: 'endBig',
    title: 'BIG終了時トップランプ',
    caption: '青＜黄＜緑＜赤＜虹の順に高設定に期待',
  },
  {
    group: 'endReg',
    title: 'REG終了時トップランプ',
    caption: '確定演出: 青=設定2以上・黄=3以上・緑=4以上・赤=5以上・虹=6確定',
  },
]

/** ハナハナ天翔向け: ボーナス・示唆の記録と設定推測 */
export function EstimatePanel() {
  const scene = useCounterStore((s) => s.scenes[s.active])
  const prefs = useCounterStore((s) => s.prefs)
  const addBonusValue = useCounterStore((s) => s.addBonusValue)
  const addHintValue = useCounterStore((s) => s.addHintValue)
  const [minusMode, setMinusMode] = useState(false)

  // ベルは「ベル」ラベルのカウンターと連動（なければ白ボタン）
  const bellKey = COLOR_KEYS.find((k) => scene.cells[k].label.includes('ベル')) ?? 'white'
  const bell = scene.cells[bellKey].count

  const feedback = (minus: boolean) => {
    if (prefs.sound) (minus ? playMinus : playClick)()
    if (prefs.vibrate && 'vibrate' in navigator) navigator.vibrate(minus ? 8 : 15)
  }

  const onBonus = (key: keyof BonusData) => {
    const delta = minusMode ? -1 : 1
    if (delta < 0 && scene.bonus[key] === 0) return
    addBonusValue(key, delta)
    feedback(minusMode)
  }

  const onHint = (group: HintGroup, color: LampColor) => {
    const delta = minusMode ? -1 : 1
    if (delta < 0 && scene.hints[group][color] === 0) return
    addHintValue(group, color, delta)
    feedback(minusMode)
  }

  const result = estimateSettings({ games: scene.games, bell, bonus: scene.bonus, hints: scene.hints })
  const maxProb = Math.max(...result.probs)

  return (
    <div className="estimate">
      <div className="estimateModeRow">
        <span className="estimateMachine">ハナハナホウオウ〜天翔〜</span>
        <button
          type="button"
          className={`stepBtn signBtn${minusMode ? ' is-minus' : ''}`}
          onClick={() => setMinusMode((m) => !m)}
          aria-pressed={minusMode}
          aria-label="減算モード切替"
        >
          {minusMode ? '−修正中' : '＋'}
        </button>
      </div>

      {/* ボーナスカウント */}
      <section className="panelBox" aria-label="ボーナス">
        <div className="panelTitle">ボーナス</div>
        <div className="bonusGrid">
          {BONUS_ITEMS.map(({ key, label }) => {
            const count = scene.bonus[key]
            const ratio =
              key === 'bigSuika'
                ? denominator(scene.bonus.big * BIG_GAMES, count)
                : denominator(scene.games, count)
            return (
              <button
                key={key}
                type="button"
                className={`bonusBtn bonus-${key}${minusMode ? ' is-minus' : ''}`}
                onClick={() => onBonus(key)}
                aria-label={`${label} ${count}回`}
              >
                <span className="bonusLabel">{label}</span>
                <span className="bonusCount">{count}</span>
                <span className="bonusRatio">{formatRatio(ratio)}</span>
              </button>
            )
          })}
        </div>
        <p className="panelCaption">
          タップで+1（BIG中スイカの確率はBIG回数×{BIG_GAMES}G換算） / ベルはカウンタータブの「
          {scene.cells[bellKey].label}」と連動: {bell}回 {formatRatio(denominator(scene.games, bell))}
        </p>
      </section>

      {/* 示唆ランプ記録 */}
      {HINT_SECTIONS.map(({ group, title, caption }) => (
        <section key={group} className="panelBox" aria-label={title}>
          <div className="panelTitle">{title}</div>
          <div className="lampRow">
            {LAMP_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`lampBtn lamp-${color}${minusMode ? ' is-minus' : ''}`}
                onClick={() => onHint(group, color)}
                aria-label={`${title} ${LAMP_NAMES[color]} ${scene.hints[group][color]}回`}
              >
                <span className="lampName">{LAMP_NAMES[color]}</span>
                <span className="lampCount">{scene.hints[group][color]}</span>
              </button>
            ))}
          </div>
          <p className="panelCaption">{caption}</p>
        </section>
      ))}

      {/* 推測結果 */}
      <section className="panelBox" aria-label="設定推測">
        <div className="panelTitle">設定推測</div>
        {result.notes.map((note) => (
          <p key={note} className="estimateNote">
            🔒 {note}
          </p>
        ))}
        {result.hasData ? (
          <div className="estimateBars">
            {result.probs.map((p, i) => (
              <div key={i} className={`estimateRow${result.excluded[i] ? ' is-excluded' : ''}`}>
                <span className="estimateSetting">設定{i + 1}</span>
                <div className="estimateBarTrack">
                  <div
                    className={`estimateBar${p === maxProb && p > 0 ? ' is-top' : ''}`}
                    style={{ width: `${Math.max(p * 100, p > 0 ? 2 : 0)}%` }}
                  />
                </div>
                <span className="estimatePct">
                  {result.excluded[i] ? '除外' : `${(p * 100).toFixed(1)}%`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="panelCaption">
            総回転数・ボーナス・ベル・示唆を記録すると設定1〜6の期待度を表示します
          </p>
        )}
        <p className="panelCaption">
          ボーナス確率は公表値、ベル・BIG中スイカ・ランプ振り分けは実戦値ベースの目安です。
          推測結果は参考値であり設定を保証するものではありません。
        </p>
      </section>
    </div>
  )
}
