import type { BonusKind, Flag, Symbol } from './types'

/** リールのコマ数 */
export const STRIP_LENGTH = 21

/** 最大すべりコマ数（ビタ押し位置から先読みして引き込む範囲） */
export const MAX_SLIP = 4

/**
 * リール配列（左・中・右）。
 * ぶどう・リプレイはどの位置からでも4コマ以内に引き込める配置。
 * ボーナス図柄（STAR/BAR）は引き込める位置が限られるため目押しが必要。
 */
export const STRIPS: [Symbol[], Symbol[], Symbol[]] = [
  // 左リール
  ['STAR', 'GRAPE', 'REPLAY', 'BAR', 'GRAPE', 'CHERRY', 'REPLAY', 'GRAPE', 'BELL', 'REPLAY', 'GRAPE', 'STAR', 'REPLAY', 'GRAPE', 'CHERRY', 'REPLAY', 'GRAPE', 'CLOWN', 'REPLAY', 'GRAPE', 'BAR'],
  // 中リール
  ['STAR', 'GRAPE', 'REPLAY', 'CHERRY', 'GRAPE', 'BELL', 'REPLAY', 'GRAPE', 'BAR', 'REPLAY', 'GRAPE', 'STAR', 'REPLAY', 'GRAPE', 'CLOWN', 'REPLAY', 'GRAPE', 'CHERRY', 'REPLAY', 'GRAPE', 'BAR'],
  // 右リール
  ['BAR', 'GRAPE', 'REPLAY', 'CHERRY', 'GRAPE', 'CLOWN', 'REPLAY', 'GRAPE', 'STAR', 'REPLAY', 'GRAPE', 'BELL', 'REPLAY', 'GRAPE', 'CHERRY', 'REPLAY', 'GRAPE', 'STAR', 'REPLAY', 'GRAPE', 'BAR'],
]

/** 図柄の表示用絵文字（すべてオリジナルの組み合わせ） */
export const SYMBOL_ICONS: Record<Symbol, string> = {
  STAR: '🌟',
  BAR: '🟦',
  GRAPE: '🍇',
  CHERRY: '🍒',
  BELL: '🔔',
  CLOWN: '🎪',
  REPLAY: '🔁',
}

/** 位置 index から見た中段の図柄 */
export function symbolAt(reel: number, index: number): Symbol {
  return STRIPS[reel][((index % STRIP_LENGTH) + STRIP_LENGTH) % STRIP_LENGTH]
}

/** 表示窓（上・中・下）の図柄 */
export function windowSymbols(reel: number, index: number): [Symbol, Symbol, Symbol] {
  return [symbolAt(reel, index - 1), symbolAt(reel, index), symbolAt(reel, index + 1)]
}

/** cur から MAX_SLIP コマ以内で target 図柄を中段に引き込める停止位置。なければ null */
export function findPullIn(reel: number, cur: number, target: Symbol): number | null {
  for (let slip = 0; slip <= MAX_SLIP; slip++) {
    const idx = (cur + slip) % STRIP_LENGTH
    if (symbolAt(reel, idx) === target) return idx
  }
  return null
}

/** cur から MAX_SLIP コマ以内で target 図柄を「避けて」停止する位置 */
function avoidSymbols(reel: number, cur: number, avoid: Symbol[]): number {
  for (let slip = 0; slip <= MAX_SLIP; slip++) {
    const idx = (cur + slip) % STRIP_LENGTH
    if (!avoid.includes(symbolAt(reel, idx))) return idx
  }
  return cur % STRIP_LENGTH
}

/** ボーナスで各リールが中段に狙う図柄 */
export function bonusTarget(kind: BonusKind, reel: number): Symbol {
  if (kind === 'BIG') return 'STAR'
  return reel === 2 ? 'BAR' : 'STAR' // REG: STAR STAR BAR
}

/**
 * 停止制御。ビタ押し位置 cur に対し、内部フラグに応じた停止位置を返す。
 *
 * - ボーナス成立中：ボーナス図柄を最優先で引き込む（ボーナス優先制御）。
 *   引き込めない場合は取りこぼし（ボーナス図柄を避けつつ停止）。
 * - 小役成立時：対応図柄を引き込む（ぶどう・リプレイは常に引き込める配置）。
 * - ハズレ：何も揃わないよう、直前までのラインと同じ図柄を避けて停止。
 */
export function resolveStop(
  reel: number,
  cur: number,
  flag: Flag,
  pendingBonus: BonusKind | null,
  lineSoFar: (Symbol | null)[],
): number {
  cur = ((cur % STRIP_LENGTH) + STRIP_LENGTH) % STRIP_LENGTH

  if (pendingBonus) {
    const target = bonusTarget(pendingBonus, reel)
    // それまでのリールが全てボーナス図柄で揃っている場合のみ引き込みが意味を持つが、
    // 実機同様どのリールでも常にボーナス図柄を狙って引き込む
    const hit = findPullIn(reel, cur, target)
    if (hit !== null) return hit
    return avoidSymbols(reel, cur, [])
  }

  switch (flag.role) {
    case 'GRAPE':
      return findPullIn(reel, cur, 'GRAPE') ?? cur
    case 'REPLAY':
      return findPullIn(reel, cur, 'REPLAY') ?? cur
    case 'BELL': {
      const hit = findPullIn(reel, cur, 'BELL')
      return hit ?? avoidLineCompletion(reel, cur, lineSoFar)
    }
    case 'CLOWN': {
      const hit = findPullIn(reel, cur, 'CLOWN')
      return hit ?? avoidLineCompletion(reel, cur, lineSoFar)
    }
    case 'CHERRY': {
      // 角チェリーは左リールにチェリーを引き込む（上下どちらかの角に出る）
      if (reel === 0) {
        for (let slip = 0; slip <= MAX_SLIP; slip++) {
          const idx = (cur + slip) % STRIP_LENGTH
          const [top, , bottom] = windowSymbols(reel, idx)
          if (top === 'CHERRY' || bottom === 'CHERRY') return idx
        }
        return cur
      }
      return avoidLineCompletion(reel, cur, lineSoFar)
    }
    case 'BIG':
    case 'REG':
      // pendingBonus 側で処理されるためここには来ないが、保険としてボーナス図柄狙い
      return findPullIn(reel, cur, bonusTarget(flag.role, reel)) ?? cur
    default:
      return avoidLineCompletion(reel, cur, lineSoFar)
  }
}

/** ハズレ時：中段ラインが揃ってしまう停止を避ける */
function avoidLineCompletion(reel: number, cur: number, lineSoFar: (Symbol | null)[]): number {
  const others = lineSoFar.filter((s, i): s is Symbol => s !== null && i !== reel)
  if (others.length === 0) return avoidSymbols(reel, cur, [])
  // 既に停止しているリールと同一図柄で揃う可能性がある場合は避ける
  const dangerous = others.every((s) => s === others[0]) ? [others[0]] : []
  return avoidSymbols(reel, cur, dangerous)
}

/** 中段ラインが指定図柄で揃っているか */
export function isLineOf(line: (Symbol | null)[], symbol: Symbol): boolean {
  return line.every((s) => s === symbol)
}

/** ボーナス図柄が揃ったか判定 */
export function checkBonusAligned(line: (Symbol | null)[], kind: BonusKind): boolean {
  if (line.some((s) => s === null)) return false
  if (kind === 'BIG') return isLineOf(line, 'STAR')
  return line[0] === 'STAR' && line[1] === 'STAR' && line[2] === 'BAR'
}
