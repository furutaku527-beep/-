import { useEffect, useState } from 'react'
import { AchievementsPanel } from './components/AchievementsPanel'
import { Controls } from './components/Controls'
import { CreditDisplay } from './components/CreditDisplay'
import { DataCounter } from './components/DataCounter'
import { DebugMenu } from './components/DebugMenu'
import { NotifyLamp } from './components/NotifyLamp'
import { ReelSet } from './components/ReelSet'
import { StatsPanel } from './components/StatsPanel'
import { SymbolDefs } from './components/symbols'
import { useAchievementsStore } from './state/achievementsStore'
import { useGameStore } from './state/gameStore'
import styles from './App.module.css'

type Tab = 'data' | 'stats' | 'ach' | 'debug'

export default function App() {
  const [tab, setTab] = useState<Tab>('data')
  const [titleTaps, setTitleTaps] = useState(0)
  const debugUnlocked = titleTaps >= 5
  const inBonus = useGameStore((s) => s.inBonus)
  const lastUnlocked = useAchievementsStore((s) => s.lastUnlocked)
  const clearToast = useAchievementsStore((s) => s.clearToast)

  useEffect(() => {
    if (!lastUnlocked) return
    const t = setTimeout(clearToast, 3000)
    return () => clearTimeout(t)
  }, [lastUnlocked, clearToast])

  return (
    <div className={`${styles.app} ${inBonus ? styles.bonusMode : ''}`}>
      <SymbolDefs />
      <header className={styles.header}>
        <h1 className={styles.title} onClick={() => setTitleTaps((n) => n + 1)}>
          ピカピカスロット
        </h1>
      </header>

      <main className={styles.machine}>
        <div className={styles.marquee}>
          <div className={styles.decoLights}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={styles.decoDot} style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <NotifyLamp />
          <div className={styles.decoLights}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={styles.decoDot} style={{ animationDelay: `${i * 0.2 + 0.1}s` }} />
            ))}
          </div>
        </div>
        <CreditDisplay />
        <ReelSet />
        <Controls />
      </main>

      <nav className={styles.tabBar}>
        <button className={tab === 'data' ? styles.tabActive : styles.tab} onClick={() => setTab('data')}>
          データ
        </button>
        <button className={tab === 'stats' ? styles.tabActive : styles.tab} onClick={() => setTab('stats')}>
          統計
        </button>
        <button className={tab === 'ach' ? styles.tabActive : styles.tab} onClick={() => setTab('ach')}>
          実績
        </button>
        {debugUnlocked && (
          <button className={tab === 'debug' ? styles.tabActive : styles.tab} onClick={() => setTab('debug')}>
            デバッグ
          </button>
        )}
      </nav>

      <section className={styles.panelArea}>
        {tab === 'data' && <DataCounter />}
        {tab === 'stats' && <StatsPanel />}
        {tab === 'ach' && <AchievementsPanel />}
        {tab === 'debug' && debugUnlocked && <DebugMenu />}
      </section>

      {lastUnlocked && (
        <div className={styles.toast}>
          <span className={styles.toastIcon}>{lastUnlocked.icon}</span>
          <div>
            <div className={styles.toastTitle}>実績解除：{lastUnlocked.title}</div>
            <div className={styles.toastDesc}>{lastUnlocked.desc}</div>
          </div>
        </div>
      )}

      <footer className={styles.footer}>
        本アプリはオリジナルのシミュレーターゲームです。実在の機種とは関係ありません。
      </footer>
    </div>
  )
}
