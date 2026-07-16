import { COLOR_KEYS, combinedDenominator, formatRatio } from '../logic/counter'
import { useCounterStore } from '../store'

/**
 * 合算確率パネル（実機の「紫→色ボタン2つ」の合算計算に相当）。
 * アプリではチップの選択式にして、2役だけでなく3役以上の合算にも対応する。
 */
export function CombinePanel() {
  const scene = useCounterStore((s) => s.scenes[s.active])
  const combine = useCounterStore((s) => s.combine)
  const toggleCombine = useCounterStore((s) => s.toggleCombine)

  const selected = COLOR_KEYS.filter((k) => combine.includes(k))
  const total = selected.reduce((sum, k) => sum + scene.cells[k].count, 0)
  const ratio = combinedDenominator(
    scene.games,
    selected.map((k) => scene.cells[k].count),
  )

  return (
    <section className="combinePanel" aria-label="合算確率">
      <div className="combineHead">
        <span className="combineTitle">合算確率</span>
        {selected.length >= 2 ? (
          <span className="combineResult">
            <span className="combineCount">{total.toLocaleString()}回</span>
            <span className="combineRatio">{formatRatio(ratio)}</span>
          </span>
        ) : (
          <span className="combineHint">2つ以上選択で表示</span>
        )}
      </div>
      <div className="combineChips">
        {COLOR_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={`chip chip-${key}${combine.includes(key) ? ' is-on' : ''}`}
            aria-pressed={combine.includes(key)}
            onClick={() => toggleCombine(key)}
          >
            {scene.cells[key].label}
          </button>
        ))}
      </div>
    </section>
  )
}
