import type { Symbol } from '../game/types'
import starUrl from '../assets/symbols/STAR.png'
import barUrl from '../assets/symbols/BAR.png'
import grapeUrl from '../assets/symbols/GRAPE.png'
import cherryUrl from '../assets/symbols/CHERRY.png'
import bellUrl from '../assets/symbols/BELL.png'
import clownUrl from '../assets/symbols/CLOWN.png'
import replayUrl from '../assets/symbols/REPLAY.png'

/**
 * リール図柄（提供された図柄画像から切り出し）。
 * 加工は scripts/extract-juggler-symbols.mjs を参照。
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

/**
 * 図柄ごとの表示ボックス。実機同様、7とBARはコマいっぱいに大きく表示して
 * 目押しの目印にし、小役図柄はふた回り小さくする。
 */
const SYMBOL_BOX: Record<Symbol, { w: number; h: number }> = {
  STAR: { w: 78, h: 64 },
  BAR: { w: 78, h: 64 },
  GRAPE: { w: 40, h: 40 },
  CHERRY: { w: 40, h: 40 },
  BELL: { w: 40, h: 40 },
  CLOWN: { w: 40, h: 40 },
  REPLAY: { w: 40, h: 40 },
}

/** リール図柄1つを描画する */
export function SlotSymbol({ symbol, size }: SlotSymbolProps) {
  const box = size ? { w: size, h: size } : SYMBOL_BOX[symbol]
  return (
    <img
      src={SYMBOL_ART[symbol]}
      width={box.w}
      height={box.h}
      alt={symbol}
      draggable={false}
      style={{ display: 'block', objectFit: 'contain' }}
    />
  )
}
