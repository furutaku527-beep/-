import { useStatsStore } from '../state/statsStore'
import styles from './Panels.module.css'

const W = 320
const H = 110

/** スランプグラフ（差枚の推移） */
export function SlumpGraph() {
  const slump = useStatsStore((s) => s.slump)

  const min = Math.min(0, ...slump)
  const max = Math.max(0, ...slump)
  const range = Math.max(max - min, 100)

  const points = slump
    .map((v, i) => {
      const x = slump.length > 1 ? (i / (slump.length - 1)) * W : 0
      const y = H - ((v - min) / range) * H
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const zeroY = H - ((0 - min) / range) * H

  return (
    <div className={styles.graphWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
        <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="#4a4494" strokeDasharray="4 4" strokeWidth={1} />
        <polyline points={points} fill="none" stroke="#ffd23f" strokeWidth={2} strokeLinejoin="round" />
      </svg>
    </div>
  )
}
