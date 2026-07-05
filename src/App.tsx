import { useEffect, useState } from 'react'
import { AchievementsPanel } from './components/AchievementsPanel'
import { Cabinet } from './components/Cabinet'
import { DataCounter } from './components/DataCounter'
import { DebugMenu } from './components/DebugMenu'
import { StatsPanel } from './components/StatsPanel'
import { useAchievementsStore } from './state/achievementsStore'
import { useGameStore } from './state/gameStore'
import bgUrl from './assets/bg.webp'
import bonusUrl from './assets/bonus.webp'
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

  const appBg = inBonus
    ? `linear-gradient(180deg, rgba(20, 8, 40, 0.5), rgba(10, 6, 26, 0.72)), url(${bonusUrl})`
    : `linear-gradient(180deg, rgba(10, 8, 24, 0.22), rgba(10, 8, 24, 0.55)), url(${bgUrl})`

  return (
    <div
      className={`${styles.app} ${inBonus ? styles.bonusMode : ''}`}
      style={{ backgroundImage: appBg }}
    >
      <Cabinet onNameTap={() => setTitleTaps((n) => n + 1)} />

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
