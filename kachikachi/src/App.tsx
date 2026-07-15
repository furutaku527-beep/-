import { useEffect, useRef, useState } from 'react'
import { COLOR_KEYS } from './logic/counter'
import { useCounterStore } from './store'
import { SceneTabs } from './components/SceneTabs'
import { GamesPanel } from './components/GamesPanel'
import { CounterCard } from './components/CounterCard'
import { CombinePanel } from './components/CombinePanel'
import { SettingsSheet } from './components/SettingsSheet'
import { unlockAudio } from './sfx'

/** 画面スリープ防止（Wake Lock API、非対応ブラウザでは何もしない） */
function useWakeLock(enabled: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!('wakeLock' in navigator)) return

    let cancelled = false
    const acquire = async () => {
      try {
        const s = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void s.release()
        } else {
          sentinelRef.current = s
        }
      } catch {
        // バッテリー低下時などは取得できない。無視してよい
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    if (enabled) {
      void acquire()
      document.addEventListener('visibilitychange', onVisible)
    }
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinelRef.current?.release()
      sentinelRef.current = null
    }
  }, [enabled])
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const keepAwake = useCounterStore((s) => s.prefs.keepAwake)
  useWakeLock(keepAwake)

  // iOS Safari対策：最初のタッチでAudioContextを起こす
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">
          カチカチくん<span className="titleSub">小役カウンター</span>
        </h1>
        <button
          type="button"
          className="iconBtn"
          aria-label="設定"
          onClick={() => setSettingsOpen(true)}
        >
          ⚙
        </button>
      </header>

      <SceneTabs />
      <GamesPanel />

      <div className="grid">
        {COLOR_KEYS.map((key) => (
          <CounterCard key={key} colorKey={key} />
        ))}
      </div>

      <CombinePanel />

      <p className="footNote">タップでカウント。データは自動保存され、オフラインでも動作します。</p>

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
