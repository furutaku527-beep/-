import { Reel } from './Reel'
import styles from './ReelSet.module.css'

export function ReelSet() {
  return (
    <div className={styles.set}>
      <Reel reel={0} />
      <Reel reel={1} />
      <Reel reel={2} />
    </div>
  )
}
