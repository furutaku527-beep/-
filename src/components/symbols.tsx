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
 * 図柄ごとの表示ボックス。実機同様、7とBARはコマ幅いっぱいに大きく表示して
 * 目押しの目印にし、小役図柄はひと回り小さくする。
 * 画像は自然な縦横比で書き出してあり、objectFit:contain で収める。
 */
const SYMBOL_BOX: Record<Symbol, { w: number; h: number }> = {
  STAR: { w: 80, h: 60 },
  BAR: { w: 80, h: 58 },
  GRAPE: { w: 48, h: 46 },
  CHERRY: { w: 48, h: 46 },
  BELL: { w: 48, h: 46 },
  CLOWN: { w: 48, h: 46 },
  REPLAY: { w: 48, h: 46 },
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
