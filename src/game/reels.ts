import type { BonusKind, Flag, Symbol } from './types'

/** リールのコマ数 */
export const STRIP_LENGTH = 21

/** 最大すべりコマ数（ビタ押し位置から先読みして引き込む範囲） */
export const MAX_SLIP = 4

/**
 * リール配列（左・中・右）。実機（ゴーゴージャグラー系）の配列構造を再現。
 *
 * - 実機同様、図柄は表示窓を上から下へ流れる（＝回転中は中段のindexが減っていく）。
 *   すべりで引き込まれるのは「窓より上にある＝indexが小さい側」の図柄。
 * - 左リールは「チェリー付BAR」（コマ④・⑮相当＝index 3・14、チェリーが直上）。
 *   BARを狙えばチェリーとボーナス図柄（7=STAR）を同時にフォローできる。
 * - 右リールは7（STAR）の直下にBAR。逆押し7狙いでREG用BARもフォローできる。
 * - 配列は scripts/search-strips.mjs で全押し位置・全押し順を検証して設計。
 */
export const STRIPS: [Symbol[], Symbol[], Symbol[]] = [
  // 左リール（BAR: 3,14 ／ チェリー: 2,13 ＝チェリー付BAR ／ 7: 10,20）
  ['GRAPE', 'REPLAY', 'CHERRY', 'BAR', 'REPLAY', 'GRAPE', 'REPLAY', 'BELL', 'GRAPE', 'CLOWN', 'STAR', 'REPLAY', 'GRAPE', 'CHERRY', 'BAR', 'GRAPE', 'REPLAY', 'GRAPE', 'GRAPE', 'REPLAY', 'STAR'],
  // 中リール（7: 11 のみ＝ボーナスは中リールの目押しが肝。7の直下にBAR）
  ['BAR', 'GRAPE', 'GRAPE', 'REPLAY', 'GRAPE', 'GRAPE', 'REPLAY', 'CHERRY', 'REPLAY', 'REPLAY', 'GRAPE', 'STAR', 'BAR', 'GRAPE', 'REPLAY', 'CHERRY', 'BELL', 'CLOWN', 'GRAPE', 'REPLAY', 'REPLAY'],
  // 右リール（7: 5,18 ／ BAR: 6,19＝7の直下。逆押し7狙いでREGフォロー可）
  ['GRAPE', 'REPLAY', 'REPLAY', 'GRAPE', 'REPLAY', 'STAR', 'BAR', 'GRAPE', 'REPLAY', 'CLOWN', 'GRAPE', 'CHERRY', 'GRAPE', 'REPLAY', 'GRAPE', 'BELL', 'GRAPE', 'REPLAY', 'STAR', 'BAR', 'GRAPE'],
]

/** 図柄の表示用絵文字（データ表示などで使用） */
export const SYMBOL_ICONS: Record<Symbol, string> = {
  STAR: '🌟',
  BAR: '🟦',
  GRAPE: '🍇',
  CHERRY: '🍒',
  BELL: '🔔',
  CLOWN: '🎪',
  REPLAY: '🔁',
}

/**
 * 有効ライン（3枚掛けの5ライン）。
 * 値は各リールの中段からの行オフセット（-1=上段, 0=中段, +1=下段）。
 */
export const LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0], // 中段
  [-1, -1, -1], // 上段
  [1, 1, 1], // 下段
  [-1, 0, 1], // 右下がり
  [1, 0, -1], // 右上がり
]

const L = STRIP_LENGTH
const norm = (i: number): number => ((i % L) + L) % L

/** 位置 index から見た中段の図柄 */
export function symbolAt(reel: number, index: number): Symbol {
  return STRIPS[reel][norm(index)]
}

/** 表示窓（上・中・下）の図柄 */
export function windowSymbols(reel: number, index: number): [Symbol, Symbol, Symbol] {
  return [symbolAt(reel, index - 1), symbolAt(reel, index), symbolAt(reel, index + 1)]
}

/** ラインの成立役。BIG=STAR揃い、REG=STAR/STAR/BAR、その他は図柄揃い */
export type LineResult = 'BIG' | 'REG' | Symbol

/** 停止index（未停止はnull）からラインの3図柄を取る */
export function lineSymbols(
  stopped: ReadonlyArray<number | null>,
  line: readonly [number, number, number],
): (Symbol | null)[] {
  return line.map((row, j) => (stopped[j] === null ? null : symbolAt(j, (stopped[j] as number) + row)))
}

/** ライン上の成立役を判定（未停止リールを含む場合は null） */
export function evalLine(syms: ReadonlyArray<Symbol | null>): LineResult | null {
  if (syms.some((s) => s === null)) return null
  const [a, b, c] = syms as Symbol[]
  if (a === 'STAR' && b === 'STAR' && c === 'STAR') return 'BIG'
  if (a === 'STAR' && b === 'STAR' && c === 'BAR') return 'REG'
  if (a === b && b === c) return a
  return null
}

export interface LineWin {
  /** LINES のインデックス */
  line: number
  result: LineResult
}

/** 全停止後の表示上の成立ライン一覧（BAR揃い・チェリー揃いは役ではないので除外） */
export function findWins(stopped: readonly [number, number, number]): LineWin[] {
  const wins: LineWin[] = []
  LINES.forEach((l, i) => {
    const r = evalLine(lineSymbols(stopped, l))
    if (r !== null && r !== 'BAR' && r !== 'CHERRY') wins.push({ line: i, result: r })
  })
  return wins
}

/** ボーナス図柄がいずれかの有効ラインに揃ったか */
export function checkBonusAligned(stopped: readonly [number, number, number], kind: BonusKind): boolean {
  return findWins(stopped).some((w) => w.result === kind)
}

/** ボーナスで各リールが狙う図柄 */
export function bonusTarget(kind: BonusKind, reel: number): Symbol {
  if (kind === 'BIG') return 'STAR'
  return reel === 2 ? 'BAR' : 'STAR' // REG: STAR STAR BAR
}

// ---------------------------------------------------------------------------
// 停止テーブル方式の停止制御
//
// 実機のリール制御と同じ発想で、「最終的な出目が満たすべき条件（述語）」ごとに
//   ok3    : 3リールの停止形が条件を満たすか
//   pair   : 2リール停止時、残り1リールがどこを押されても条件を満たせるか
//   single : 1リール停止時、残り2リールがどの順・どこを押されても満たせるか
// を事前計算しておき、停止時は「すべり最小で、以降どう押されても破綻しない位置」
// を選ぶ。これにより全押し順・全押し位置で取りこぼしゼロ／誤入賞ゼロを保証する。
// ---------------------------------------------------------------------------

/** 左リール窓にチェリーが入るか */
function leftWindowCherry(i0: number): boolean {
  return windowSymbols(0, i0).includes('CHERRY')
}

/** 左リール中段がチェリーか */
function leftCenterCherry(i0: number): boolean {
  return symbolAt(0, i0) === 'CHERRY'
}

/** 出目の全ライン成立役（BAR揃い等も含む生の判定） */
function rawResults(i0: number, i1: number, i2: number): LineResult[] {
  const out: LineResult[] = []
  for (const l of LINES) {
    const r = evalLine([symbolAt(0, i0 + l[0]), symbolAt(1, i1 + l[1]), symbolAt(2, i2 + l[2])])
    if (r !== null) out.push(r)
  }
  return out
}

type PredName =
  | 'NONE' // 何も揃わない・チェリー非表示（ハズレ）
  | 'GRAPE' // ぶどうのみ成立（必ず揃える）
  | 'REPLAY' // リプレイのみ成立（必ず揃える）
  | 'QUIET' // 何も揃わない・角チェリーは許容（チェリーフラグ時の他リール等）
  | 'CH_CORNER' // 何も揃わない・角チェリー表示
  | 'MIDC' // 何も揃わない・中段チェリー表示（プレミアム）
  | 'BSAFE_BIG' // BIG以外は何も揃わない（BIG成立中の安全条件）
  | 'BSAFE_REG' // REG以外は何も揃わない

function predicate(name: PredName, i0: number, i1: number, i2: number): boolean {
  const rs = rawResults(i0, i1, i2)
  switch (name) {
    case 'NONE':
      return rs.length === 0 && !leftWindowCherry(i0)
    case 'GRAPE':
      return rs.length > 0 && rs.every((r) => r === 'GRAPE') && !leftWindowCherry(i0)
    case 'REPLAY':
      return rs.length > 0 && rs.every((r) => r === 'REPLAY') && !leftWindowCherry(i0)
    case 'QUIET':
      return rs.length === 0 && !leftCenterCherry(i0)
    case 'CH_CORNER':
      return rs.length === 0 && leftWindowCherry(i0) && !leftCenterCherry(i0)
    case 'MIDC':
      return rs.length === 0 && leftCenterCherry(i0)
    case 'BSAFE_BIG':
      return rs.every((r) => r === 'BIG') && !leftWindowCherry(i0)
    case 'BSAFE_REG':
      return rs.every((r) => r === 'REG') && !leftWindowCherry(i0)
  }
}

interface StopTables {
  /** ok3[(i0*21+i1)*21+i2] */
  ok3: Uint8Array
  /** pair[missingReel][a*21+b]（a,bは残り2リールのうちリール番号昇順） */
  pair: [Uint8Array, Uint8Array, Uint8Array]
  /** single[heldReel][idx] */
  single: [Uint8Array, Uint8Array, Uint8Array]
  /** どのリールから・どこを押されても成立させられるか */
  root: boolean
}

/** good[c] が「押し位置p→窓{p..p-4}のどこかにgood」を全pで満たすか */
function coveredByWindows(good: Uint8Array): boolean {
  // 全ての連続5コマ窓にgoodが1つ以上 ⇔ badの循環連続長が5未満
  let run = 0
  for (let i = 0; i < L * 2; i++) {
    if (good[i % L]) run = 0
    else if (++run >= MAX_SLIP + 1) return false
  }
  return true
}

function buildTables(name: PredName): StopTables {
  const ok3 = new Uint8Array(L * L * L)
  for (let a = 0; a < L; a++)
    for (let b = 0; b < L; b++)
      for (let c = 0; c < L; c++) ok3[(a * L + b) * L + c] = predicate(name, a, b, c) ? 1 : 0

  const pair: [Uint8Array, Uint8Array, Uint8Array] = [
    new Uint8Array(L * L),
    new Uint8Array(L * L),
    new Uint8Array(L * L),
  ]
  const good = new Uint8Array(L)
  for (let missing = 0; missing < 3; missing++) {
    for (let a = 0; a < L; a++) {
      for (let b = 0; b < L; b++) {
        for (let c = 0; c < L; c++) {
          const t: [number, number, number] =
            missing === 0 ? [c, a, b] : missing === 1 ? [a, c, b] : [a, b, c]
          good[c] = ok3[(t[0] * L + t[1]) * L + t[2]]
        }
        pair[missing][a * L + b] = coveredByWindows(good) ? 1 : 0
      }
    }
  }

  const single: [Uint8Array, Uint8Array, Uint8Array] = [
    new Uint8Array(L),
    new Uint8Array(L),
    new Uint8Array(L),
  ]
  for (let held = 0; held < 3; held++) {
    const others = [0, 1, 2].filter((r) => r !== held)
    for (let v = 0; v < L; v++) {
      let ok = true
      for (const u of others) {
        const third = others.find((r) => r !== u) as number
        // uをcで止めた後、残りthirdがpairで守れるか
        for (let c = 0; c < L; c++) {
          // pair[third]のインデックスは (held,u) をリール番号昇順で
          const [x, y] = held < u ? [v, c] : [c, v]
          good[c] = pair[third][x * L + y]
        }
        if (!coveredByWindows(good)) {
          ok = false
          break
        }
      }
      single[held][v] = ok ? 1 : 0
    }
  }

  let root = true
  for (let held = 0; held < 3 && root; held++) {
    root = coveredByWindows(single[held])
  }

  return { ok3, pair, single, root }
}

const tableCache = new Map<PredName, StopTables>()

function tables(name: PredName): StopTables {
  let t = tableCache.get(name)
  if (!t) {
    t = buildTables(name)
    tableCache.set(name, t)
  }
  return t
}

/** 現在の停止状況で、このリールを idx で止めても述語を守り続けられるか */
function stateOK(tbl: StopTables, reel: number, idx: number, stopped: ReadonlyArray<number | null>): boolean {
  const others = [0, 1, 2].filter((r) => r !== reel)
  const known = others.filter((r) => stopped[r] !== null)
  if (known.length === 2) {
    const t: [number, number, number] = [0, 0, 0]
    t[reel] = idx
    for (const r of others) t[r] = stopped[r] as number
    return tbl.ok3[(t[0] * L + t[1]) * L + t[2]] === 1
  }
  if (known.length === 1) {
    const o = known[0]
    const missing = others.find((r) => r !== o) as number
    const [x, y] = reel < o ? [idx, stopped[o] as number] : [stopped[o] as number, idx]
    return tbl.pair[missing][x * L + y] === 1
  }
  return tbl.single[reel][idx] === 1
}

/** テーブルに従い、すべり最小で条件を満たす停止位置を探す */
function tableStop(
  name: PredName,
  reel: number,
  cur: number,
  stopped: ReadonlyArray<number | null>,
): number | null {
  const tbl = tables(name)
  for (let slip = 0; slip <= MAX_SLIP; slip++) {
    const idx = norm(cur - slip)
    if (stateOK(tbl, reel, idx, stopped)) return idx
  }
  return null
}

// --- ボーナス・ベル・ピエロ用の貪欲引き込み（目押し依存の役） ---

/** ライン l を残りの未停止リールで完成させ得るか（他役の同時完成なしで） */
function finishable(
  l: readonly [number, number, number],
  trial: (number | null)[],
  targetOf: (reel: number) => Symbol,
  allowed: LineResult,
): boolean {
  const j = trial.findIndex((s) => s === null)
  if (j === -1) {
    const rs = rawResults(trial[0] as number, trial[1] as number, trial[2] as number)
    if (!rs.every((r) => r === allowed)) return false
    return !leftWindowCherry(trial[0] as number)
  }
  for (let idx = 0; idx < L; idx++) {
    if (symbolAt(j, idx + l[j]) !== targetOf(j)) continue
    trial[j] = idx
    const ok = finishable(l, trial, targetOf, allowed)
    trial[j] = null
    if (ok) return true
  }
  return false
}

/**
 * 目的図柄をいずれかの有効ライン上に引き込む（先読み付き）。
 * 候補は「そのラインが残りリールで完成可能」かつ
 * 「完成しなかった場合も safety テーブルで安全に逃げられる」ものだけ採用。
 */
function greedyPull(
  reel: number,
  cur: number,
  targetOf: (reel: number) => Symbol,
  allowed: LineResult,
  stopped: ReadonlyArray<number | null>,
  safety: PredName,
): number | null {
  const safetyTbl = tables(safety)
  const isFinal = stopped.filter((s) => s !== null).length === 2
  for (let slip = 0; slip <= MAX_SLIP; slip++) {
    const idx = norm(cur - slip)
    for (const l of LINES) {
      if (symbolAt(reel, idx + l[reel]) !== targetOf(reel)) continue
      const live = stopped.every((s, j) => j === reel || s === null || symbolAt(j, s + l[j]) === targetOf(j))
      if (!live) continue
      const trial = [...stopped]
      trial[reel] = idx
      if (!finishable(l, trial, targetOf, allowed)) continue
      // 完成前の停止は、以降どう押されても安全条件へ逃げられる位置に限る
      if (!isFinal && !stateOK(safetyTbl, reel, idx, stopped)) continue
      return idx
    }
  }
  return null
}

/**
 * 停止制御。ビタ押し位置 cur に対し、内部フラグに応じた停止位置を返す。
 * stopped は各リールの停止index（未停止・自分自身は null）。
 */
export function resolveStop(
  reel: number,
  cur: number,
  flag: Flag,
  pendingBonus: BonusKind | null,
  stopped: ReadonlyArray<number | null>,
): number {
  cur = norm(cur)

  if (pendingBonus) {
    // 中段チェリー成立ゲーム：左リール中段チェリーのプレミアム出目を最優先
    if (flag.midCherry) {
      const mid = tableStop('MIDC', reel, cur, stopped)
      if (mid !== null) return mid
      if (reel === 0) {
        const corner = tableStop('CH_CORNER', reel, cur, stopped)
        if (corner !== null) return corner
      }
      return tableStop('QUIET', reel, cur, stopped) ?? cur
    }
    const safety: PredName = pendingBonus === 'BIG' ? 'BSAFE_BIG' : 'BSAFE_REG'
    const hit = greedyPull(reel, cur, (j) => bonusTarget(pendingBonus, j), pendingBonus, stopped, safety)
    if (hit !== null) return hit
    return tableStop(safety, reel, cur, stopped) ?? cur
  }

  switch (flag.role) {
    case 'GRAPE':
    case 'REPLAY':
      // 100%引き込み役：テーブルが全押し順・全押し位置で成立を保証する
      return tableStop(flag.role, reel, cur, stopped) ?? tableStop('NONE', reel, cur, stopped) ?? cur
    case 'BELL':
    case 'CLOWN': {
      // 目押し必要役：届けば揃え、届かなければ完全に外す（取りこぼし）
      const role = flag.role
      const hit = greedyPull(reel, cur, () => role, role, stopped, 'NONE')
      if (hit !== null) return hit
      return tableStop('NONE', reel, cur, stopped) ?? cur
    }
    case 'CHERRY': {
      // チェリーは左リールの表示のみ。角優先、届かなければ取りこぼし
      if (reel === 0) {
        const hit = tableStop('CH_CORNER', reel, cur, stopped)
        if (hit !== null) return hit
      }
      return tableStop('QUIET', reel, cur, stopped) ?? cur
    }
    case 'BIG':
    case 'REG': {
      // pendingBonus 側で処理されるためここには来ないが、保険
      const safety: PredName = flag.role === 'BIG' ? 'BSAFE_BIG' : 'BSAFE_REG'
      const hit = greedyPull(reel, cur, (j) => bonusTarget(flag.role as BonusKind, j), flag.role, stopped, safety)
      if (hit !== null) return hit
      return tableStop(safety, reel, cur, stopped) ?? cur
    }
    default:
      return tableStop('NONE', reel, cur, stopped) ?? cur
  }
}

/** 配列検証用：全述語テーブルが全押し順・全押し位置で成立可能か */
export function verifyStripDesign(): Record<string, boolean> {
  const names: PredName[] = ['NONE', 'GRAPE', 'REPLAY', 'QUIET']
  const out: Record<string, boolean> = {}
  for (const n of names) out[n] = tables(n).root
  return out
}
