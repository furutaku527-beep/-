import { useState } from 'react'
import {
  type BonusData,
  COLOR_KEYS,
  denominator,
  formatRatio,
  getHint,
} from '../logic/counter'
import { MACHINES, getMachine, type HintSection } from '../logic/machines'
import { estimate } from '../logic/estimate'
import { useCounterStore } from '../store'
import { playClick, playMinus } from '../sfx'

const BONUS_ITEMS: { key: keyof BonusData; label: string }[] = [
  { key: 'big', label: 'BIG' },
  { key: 'reg', label: 'REG' },
  { key: 'bigSuika', label: 'BIG中スイカ' },
]

/** ハナハナ系: 機種を選んでボーナス・示唆を記録し設定推測 */
export function EstimatePanel() {
  const scene = useCounterStore((s) => s.scenes[s.active])
  const prefs = useCounterStore((s) => s.prefs)
  const setMachine = useCounterStore((s) => s.setMachine)
  const addBonusValue = useCounterStore((s) => s.addBonusValue)
  const addHintValue = useCounterStore((s) => s.addHintValue)
  const [minusMode, setMinusMode] = useState(false)

  const machine = getMachine(scene.machineId)

  // ベルは「ベル」ラベルのカウンターと連動。
  // 該当ラベルがない場合は連動しない（別の役の数値をベルとして
  // 推測に流し込まないため）
  const bellKey = COLOR_KEYS.find((k) => scene.cells[k].label.includes('ベル'))
  const bell = bellKey ? scene.cells[bellKey].count : 0

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

  const onHint = (section: HintSection, optKey: string) => {
    const delta = minusMode ? -1 : 1
    if (delta < 0 && getHint(scene, section.id, optKey) === 0) return
    addHintValue(section.id, optKey, delta)
    feedback(minusMode)
  }

  const result = estimate(machine, { games: scene.games, bell, bonus: scene.bonus, hints: scene.hints })
  const maxProb = Math.max(...result.probs)

  return (
    <div className="estimate">
      {/* 機種セレクタ（機種はシーンごとに保存） */}
      <div className="machineRow">
        <label className="machineLabel" htmlFor="machineSelect">
          機種
        </label>
        <select
          id="machineSelect"
          className="machineSelect"
          value={machine.id}
          onChange={(e) => setMachine(e.target.value)}
        >
          {MACHINES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
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
      <p className="machineNote">機種の選択はシーン（A/B/C）ごとに保存されます</p>

      {/* ボーナスカウント */}
      <section className="panelBox" aria-label="ボーナス">
        <div className="panelTitle">ボーナス</div>
        <div className="bonusGrid">
          {BONUS_ITEMS.map(({ key, label }) => {
            const count = scene.bonus[key]
            const ratio =
              key === 'bigSuika'
                ? denominator(scene.bonus.big * machine.bigGames, count)
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
        <div className="bonusSummary">
          <span>
            合算 {(scene.bonus.big + scene.bonus.reg).toLocaleString()}回{' '}
            <b>{formatRatio(denominator(scene.games, scene.bonus.big + scene.bonus.reg))}</b>
          </span>
          <span>
            ベル {bell.toLocaleString()}回 <b>{formatRatio(denominator(scene.games, bell))}</b>
          </span>
        </div>
        <p className="panelCaption">
          タップで+1（BIG中スイカの確率はBIG回数×{machine.bigGames}G換算）。
          {bellKey
            ? `ベルはカウンタータブの「${scene.cells[bellKey].label}」と連動しています。`
            : 'ベルを推測に使うには、カウンタータブでいずれかの役名を「ベル」にしてください。'}
        </p>
      </section>

      {/* 機種ごとの示唆セクション */}
      {machine.hintSections.map((section) => (
        <section key={section.id} className="panelBox" aria-label={section.title}>
          <div className="panelTitle">{section.title}</div>
          <div className={`lampRow cols-${section.options.length}`}>
            {section.options.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`lampBtn${opt.tone ? ` lamp-${opt.tone}` : ''}${minusMode ? ' is-minus' : ''}`}
                onClick={() => onHint(section, opt.key)}
                aria-label={`${section.title} ${opt.label} ${getHint(scene, section.id, opt.key)}回`}
              >
                <span className="lampName">{opt.label}</span>
                <span className="lampCount">{getHint(scene, section.id, opt.key)}</span>
              </button>
            ))}
          </div>
          <p className="panelCaption">{section.caption}</p>
        </section>
      ))}

      {/* 推測結果 */}
      <section className="panelBox" aria-label="設定推測">
        <div className="panelTitle">設定推測（{machine.shortName}）</div>
        {result.notes.map((note) => (
          <p key={note} className="estimateNote">
            🔒 {note}
          </p>
        ))}
        {result.hasData ? (
          <>
            <div className="estimateBars">
              {result.probs.map((p, i) => (
                <div key={i} className={`estimateRow${result.excluded[i] ? ' is-excluded' : ''}`}>
                  <span className="estimateSetting">設定{result.settings[i]}</span>
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
            <div className="estimateSummary">
              <span>
                設定4以上{' '}
                <b>{(result.probs.slice(3).reduce((a, b) => a + b, 0) * 100).toFixed(1)}%</b>
              </span>
              <span>
                設定6 <b>{(result.probs[result.probs.length - 1] * 100).toFixed(1)}%</b>
              </span>
            </div>
          </>
        ) : (
          <p className="panelCaption">
            総回転数・ボーナス・ベル・示唆を記録すると各設定の期待度を表示します
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
