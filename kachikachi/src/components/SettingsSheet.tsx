import { useCounterStore } from '../store'

interface Props {
  onClose: () => void
}

/** 設定シート：音・バイブ・スリープ防止と、シーン/全データのリセット */
export function SettingsSheet({ onClose }: Props) {
  const prefs = useCounterStore((s) => s.prefs)
  const active = useCounterStore((s) => s.active)
  const setPref = useCounterStore((s) => s.setPref)
  const resetActiveScene = useCounterStore((s) => s.resetActiveScene)
  const resetAll = useCounterStore((s) => s.resetAll)

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

        <div className="sheetDivider" />

        <div className="helpText">
          <p>役名はカード左上の名前をタップで変更できます。</p>
          <p>確率はカウントと同時に常時表示されます（総回転数 ÷ カウント数）。</p>
          <p>シーンA/B/Cで通常時・ボーナス中などを別々にカウントできます。</p>
        </div>

        <button type="button" className="closeBtn" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  )
}
