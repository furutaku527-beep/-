import { combinedBonusDenom, SETTINGS } from '../game/settings'
import { useGameStore } from '../state/gameStore'
import { useStatsStore } from '../state/statsStore'
import styles from './Panels.module.css'

function denom(games: number, count: number): string {
  if (count === 0) return '-'
  return `1/${(games / count).toFixed(1)}`
}

/** 各種確率の実測値と理論値をリアルタイム表示 */
export function StatsPanel() {
  const setting = useGameStore((s) => s.setting)
  const totalGames = useStatsStore((s) => s.totalGames)
  const bigCount = useStatsStore((s) => s.bigCount)
  const regCount = useStatsStore((s) => s.regCount)
  const grapeCount = useStatsStore((s) => s.grapeCount)
  const cherryCount = useStatsStore((s) => s.cherryCount)
  const replayCount = useStatsStore((s) => s.replayCount)
  const diff = useStatsStore((s) => s.diff)

  const t = SETTINGS[setting]

  const rows: [string, string, string][] = [
    ['BIG', denom(totalGames, bigCount), `1/${t.big}`],
    ['REG', denom(totalGames, regCount), `1/${t.reg}`],
    ['合算', denom(totalGames, bigCount + regCount), `1/${combinedBonusDenom(setting).toFixed(1)}`],
    ['ぶどう', denom(totalGames, grapeCount), `1/${t.grape}`],
    ['チェリー', denom(totalGames, cherryCount), `1/${t.cherry}`],
    ['リプレイ', denom(totalGames, replayCount), `1/${t.replay}`],
  ]

  return (
    <div className={styles.panel}>
      <div className={styles.title}>STATS</div>
      <table className={styles.statTable}>
        <thead>
          <tr>
            <th>役</th>
            <th>実測</th>
            <th>理論値</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, actual, theory]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>{actual}</td>
              <td>{theory}</td>
            </tr>
          ))}
          <tr>
            <td>差枚</td>
            <td colSpan={2}>{diff >= 0 ? '+' : ''}{diff}</td>
          </tr>
          <tr>
            <td>総ゲーム数</td>
            <td colSpan={2}>{totalGames}G</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
