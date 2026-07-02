import type { Symbol } from '../game/types'
import starUrl from '../assets/symbols/STAR.png'
import barUrl from '../assets/symbols/BAR.png'
import grapeUrl from '../assets/symbols/GRAPE.png'
import cherryUrl from '../assets/symbols/CHERRY.png'
import bellUrl from '../assets/symbols/BELL.png'
import clownUrl from '../assets/symbols/CLOWN.png'
import replayUrl from '../assets/symbols/REPLAY.png'

/**
 * リール図柄（AI生成のスプライトシートから切り出したオリジナルアート）。
 * シートの加工は scripts/prepare-assets.mjs を参照。
 */
export const SYMBOL_ART: Record<Symbol, string> = {
  STAR: starUrl,
  BAR: barUrl,
  GRAPE: grapeUrl,
  CHERRY: cherryUrl,
  BELL: bellUrl,
  CLOWN: clownUrl,
  REPLAY: replayUrl,
}

// 初回スピン時のちらつき防止のため先読みしておく
if (typeof window !== 'undefined') {
  for (const src of Object.values(SYMBOL_ART)) {
    const img = new Image()
    img.src = src
  }
}

interface SlotSymbolProps {
  symbol: Symbol
  size?: number
}

/** リール図柄1つを描画する。BARブロックには文字をオーバーレイする */
export function SlotSymbol({ symbol, size = 54 }: SlotSymbolProps) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size }}>
      <img
        src={SYMBOL_ART[symbol]}
        width={size}
        height={size}
        alt={symbol}
        draggable={false}
        style={{ display: 'block' }}
      />
      {symbol === 'BAR' && (
        <b
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            font: `italic 900 ${Math.round(size * 0.3)}px/1 'Arial Black', Arial, sans-serif`,
            letterSpacing: 1,
            color: '#fff',
            textShadow: '0 1px 3px rgba(9, 44, 92, 0.95), 0 0 6px rgba(9, 44, 92, 0.8)',
            pointerEvents: 'none',
          }}
        >
          BAR
        </b>
      )}
    </span>
  )
}
