import { useState } from 'react'
import { useCounterStore } from '../store'
import { HelpSheet } from './HelpSheet'

interface Props {
  onClose: () => void
}

/** 設定シート：使い方・仕組み、音・バイブ・スリープ防止と、シーン/全データのリセット */
export function SettingsSheet({ onClose }: Props) {
  const prefs = useCounterStore((s) => s.prefs)
  const active = useCounterStore((s) => s.active)
  const setPref = useCounterStore((s) => s.setPref)
  const resetActiveScene = useCounterStore((s) => s.resetActiveScene)
  const resetAll = useCounterStore((s) => s.resetAll)
  const [helpOpen, setHelpOpen] = useState(false)

  const confirmSceneReset = () => {
    if (window.confirm(`シーン${active}のカウントと総回転数をすべて0にします。よろしいですか？`)) {
      resetActiveScene()
      onClose()
    }
  }

  const confirmAllReset = () => {
    if (window.confirm('全シーン（A/B/C）のデータをすべて消去します。よろしいですか？')) {
      resetAll()
      onClose()
    }
  }

  return (
    <div className="sheetOverlay" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="設定"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheetHandle" aria-hidden="true" />
        <h2 className="sheetTitle">設定</h2>

        <button type="button" className="helpEntryBtn" onClick={() => setHelpOpen(true)}>
          <span>📖 使い方・仕組みを見る</span>
          <span className="helpEntryChevron" aria-hidden="true">›</span>
        </button>

        <div className="sheetDivider" />

        <label className="toggleRow">
          <span>カウント音（カチッ）</span>
          <input
            type="checkbox"
            checked={prefs.sound}
            onChange={(e) => setPref('sound', e.target.checked)}
          />
        </label>
        <label className="toggleRow">
          <span>バイブレーション</span>
          <input
            type="checkbox"
            checked={prefs.vibrate}
            onChange={(e) => setPref('vibrate', e.target.checked)}
          />
        </label>
        <label className="toggleRow">
          <span>画面スリープ防止</span>
          <input
            type="checkbox"
            checked={prefs.keepAwake}
            onChange={(e) => setPref('keepAwake', e.target.checked)}
          />
        </label>

        <div className="sheetDivider" />

        <button type="button" className="dangerBtn" onClick={confirmSceneReset}>
          シーン{active}をリセット
        </button>
        <button type="button" className="dangerBtn dangerBtn-strong" onClick={confirmAllReset}>
          全データをリセット
        </button>

        <button type="button" className="closeBtn" onClick={onClose}>
          閉じる
        </button>
      </div>

      {helpOpen && <HelpSheet onClose={() => setHelpOpen(false)} />}
    </div>
  )
}
