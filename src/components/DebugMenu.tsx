import { useState } from 'react'
import { simulate, type SimResult } from '../game/simulate'
import { SETTING_LEVELS } from '../game/settings'
import { useGameStore } from '../state/gameStore'
import styles from './Panels.module.css'

/** 隠しメニュー：設定変更・高速シミュレーション・データリセット */
export function DebugMenu() {
  const setting = useGameStore((s) => s.setting)
  const setSetting = useGameStore((s) => s.setSetting)
  const addCredits = useGameStore((s) => s.addCredits)
  const resetAll = useGameStore((s) => s.resetAll)
  const [simGames, setSimGames] = useState(10000)
  const [result, setResult] = useState<SimResult | null>(null)

  const runSim = () => {
    setResult(simulate(setting, simGames))
  }

  return (
    <div className={styles.panel}>
      <div className={styles.title}>DEBUG</div>

      <div className={styles.debugRow}>
        <span className={styles.note}>設定：</span>
        {SETTING_LEVELS.map((lv) => (
          <button
            key={lv}
            className={`${styles.settingBtn} ${lv === setting ? styles.settingActive : ''}`}
            onClick={() => setSetting(lv)}
          >
            {lv}
          </button>
        ))}
      </div>

      <div className={styles.debugRow}>
        {[1000, 10000, 100000].map((n) => (
          <button
            key={n}
            className={`${styles.debugBtn} ${simGames === n ? styles.settingActive : ''}`}
            onClick={() => setSimGames(n)}
          >
            {n.toLocaleString()}G
          </button>
        ))}
        <button className={styles.debugBtn} onClick={runSim}>
          シミュレート実行
        </button>
      </div>

      {result && (
        <div className={styles.simResult}>
          <div>設定{setting} / {result.games.toLocaleString()}G の結果</div>
          <div>BIG: {result.big}回（1/{result.bigDenom.toFixed(1)}）</div>
          <div>REG: {result.reg}回（1/{result.regDenom.toFixed(1)}）</div>
          <div>合算: 1/{result.combinedDenom.toFixed(1)}</div>
          <div>ぶどう: {result.grape}回（1/{result.grapeDenom.toFixed(2)}）</div>
          <div>差枚: {result.diff >= 0 ? '+' : ''}{result.diff.toLocaleString()}枚</div>
        </div>
      )}

      <div className={styles.debugRow}>
        <button className={styles.debugBtn} onClick={() => addCredits(1000)}>
          +1000枚
        </button>
        <button
          className={`${styles.debugBtn} ${styles.dangerBtn}`}
          onClick={() => {
            if (window.confirm('セーブデータをすべてリセットします。よろしいですか？')) {
              resetAll()
            }
          }}
        >
          データリセット
        </button>
      </div>

      <div className={styles.note}>
        シミュレーションは内部抽選のみを高速に回すもので、実際のセーブデータには影響しません。
      </div>
    </div>
  )
}
