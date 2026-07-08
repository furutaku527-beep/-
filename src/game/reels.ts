import type { BonusKind, Flag, Symbol } from './types'

/** リールのコマ数 */
export const STRIP_LENGTH = 21

/** 最大すべりコマ数（ビタ押し位置から先読みして引き込む範囲） */
export const MAX_SLIP = 4

/**
 * リール配列（左・中・右）。実機アイムジャグラーの公表配列をそのまま転記。
 *
 * - 実機同様、図柄は表示窓を上から下へ流れる（＝回転中は中段のindexが減っていく）。
 *   すべりで引き込まれるのは「窓より上にある＝indexが小さい側」の図柄。
 * - 配列表のコマ番号（①下〜㉑上）との対応は index = 21 − 番号。
 * - 左リールは「チェリー付BAR」（⑮BARの下⑭にチェリー／④BARの上⑤にチェリー）。
 *   BAR狙いでチェリーと7を同時にフォローできる。
 * - 右リールはBARが1つだけ（7の直下）。チェリーは右リールに無い（実機同様）。
 */
export const STRIPS: [Symbol[], Symbol[], Symbol[]] = [
  // 左リール（㉑ベル ⑳7 ⑲リプ ⑱ぶどう ⑰リプ ⑯ぶどう ⑮BAR ⑭チェリー ⑬ぶどう
  //          ⑫リプ ⑪ぶどう ⑩7 ⑨ピエロ ⑧ぶどう ⑦リプ ⑥ぶどう ⑤チェリー ④BAR ③ぶどう ②リプ ①ぶどう）
  ['BELL', 'STAR', 'REPLAY', 'GRAPE', 'REPLAY', 'GRAPE', 'BAR', 'CHERRY', 'GRAPE', 'REPLAY', 'GRAPE', 'STAR', 'CLOWN', 'GRAPE', 'REPLAY', 'GRAPE', 'CHERRY', 'BAR', 'GRAPE', 'REPLAY', 'GRAPE'],
  // 中リール（㉑リプ ⑳7 ⑲ぶどう ⑱チェリー ⑰リプ ⑯ベル ⑮ぶどう ⑭チェリー ⑬リプ
  //          ⑫BAR ⑪ぶどう ⑩チェリー ⑨リプ ⑧ベル ⑦ぶどう ⑥チェリー ⑤リプ ④BAR ③ぶどう ②チェリー ①ピエロ）
  ['REPLAY', 'STAR', 'GRAPE', 'CHERRY', 'REPLAY', 'BELL', 'GRAPE', 'CHERRY', 'REPLAY', 'BAR', 'GRAPE', 'CHERRY', 'REPLAY', 'BELL', 'GRAPE', 'CHERRY', 'REPLAY', 'BAR', 'GRAPE', 'CHERRY', 'CLOWN'],
  // 右リール（㉑ぶどう ⑳7 ⑲BAR ⑱ベル ⑰リプ ⑯ぶどう ⑮ピエロ ⑭ベル ⑬リプ
  //          ⑫ぶどう ⑪ピエロ ⑩ベル ⑨リプ ⑧ぶどう ⑦ピエロ ⑥ベル ⑤リプ ④ぶどう ③ピエロ ②ベル ①リプ）
  ['GRAPE', 'STAR', 'BAR', 'BELL', 'REPLAY', 'GRAPE', 'CLOWN', 'BELL', 'REPLAY', 'GRAPE', 'CLOWN', 'BELL', 'REPLAY', 'GRAPE', 'CLOWN', 'BELL', 'REPLAY', 'GRAPE', 'CLOWN', 'BELL', 'REPLAY'],
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

type LineSet = ReadonlyArray<readonly [number, number, number]>

/** 賭け枚数に応じた有効ライン（3枚=5ライン、1枚=中段のみ） */
export function activeLines(bet: number): LineSet {
  return bet >= 3 ? LINES : LINES.slice(0, 1)
}

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
export function findWins(stopped: readonly [number, number, number], bet = 3): LineWin[] {
  const wins: LineWin[] = []
  activeLines(bet).forEach((l, i) => {
    const r = evalLine(lineSymbols(stopped, l))
    if (r !== null && r !== 'BAR' && r !== 'CHERRY') wins.push({ line: i, result: r })
  })
  return wins
}

/** ボーナス図柄がいずれかの有効ラインに揃ったか */
export function checkBonusAligned(
  stopped: readonly [number, number, number],
  kind: BonusKind,
  bet = 3,
): boolean {
  return findWins(stopped, bet).some((w) => w.result === kind)
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

/**
 * 出目のライン成立役のうち払い出しに関わるもの。
 * BAR揃い・チェリー揃いは役ではないため除外する
 * （実機でもBAR揃いはガセ目としてハズレ時に普通に停止する）。
 */
function rawResults(lines: LineSet, i0: number, i1: number, i2: number): LineResult[] {
  const out: LineResult[] = []
  for (const l of lines) {
    const r = evalLine([symbolAt(0, i0 + l[0]), symbolAt(1, i1 + l[1]), symbolAt(2, i2 + l[2])])
    if (r !== null && r !== 'BAR' && r !== 'CHERRY') out.push(r)
  }
  return out
}

/**
 * ボーナス図柄テンパイか（有効ライン上にボーナス図柄=STARが2つ以上並ぶ）。
 * 実機ジャグラーではこの形（7・7・× 等）は「ボーナス確定リーチ目」であり、
 * ボーナス非成立の通常時には絶対に出ない。逆に出たら次にペカる。
 */
export function isBonusTempai(
  lines: LineSet,
  i0: number,
  i1: number,
  i2: number,
): boolean {
  for (const l of lines) {
    let stars = 0
    if (symbolAt(0, i0 + l[0]) === 'STAR') stars++
    if (symbolAt(1, i1 + l[1]) === 'STAR') stars++
    if (symbolAt(2, i2 + l[2]) === 'STAR') stars++
    if (stars >= 2) return true
  }
  return false
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

function predicate(name: PredName, lines: LineSet, i0: number, i1: number, i2: number): boolean {
  const rs = rawResults(lines, i0, i1, i2)
  // 通常時（ボーナス非成立）はボーナス図柄テンパイを絶対に出さない。
  // → テンパイ形が出るのはボーナス成立中だけ＝「出たら確定リーチ目」になる。
  const tempai = isBonusTempai(lines, i0, i1, i2)
  switch (name) {
    case 'NONE':
      return rs.length === 0 && !leftWindowCherry(i0) && !tempai
    case 'GRAPE':
      return rs.length > 0 && rs.every((r) => r === 'GRAPE') && !leftWindowCherry(i0) && !tempai
    case 'REPLAY':
      return rs.length > 0 && rs.every((r) => r === 'REPLAY') && !leftWindowCherry(i0) && !tempai
    case 'QUIET':
      return rs.length === 0 && !leftCenterCherry(i0) && !tempai
    case 'CH_CORNER':
      return rs.length === 0 && leftWindowCherry(i0) && !leftCenterCherry(i0) && !tempai
    case 'MIDC':
      return rs.length === 0 && leftCenterCherry(i0) && !tempai
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

function buildTables(name: PredName, lines: LineSet): StopTables {
  const ok3 = new Uint8Array(L * L * L)
  for (let a = 0; a < L; a++)
    for (let b = 0; b < L; b++)
      for (let c = 0; c < L; c++) ok3[(a * L + b) * L + c] = predicate(name, lines, a, b, c) ? 1 : 0

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

const tableCache = new Map<string, StopTables>()

function tables(name: PredName, lines: LineSet): StopTables {
  const key = `${name}:${lines.length}`
  let t = tableCache.get(key)
  if (!t) {
    t = buildTables(name, lines)
    tableCache.set(key, t)
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
  lines: LineSet,
): number | null {
  const tbl = tables(name, lines)
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
  lines: LineSet,
): boolean {
  const j = trial.findIndex((s) => s === null)
  if (j === -1) {
    const i0 = trial[0] as number
    const rs = rawResults(lines, i0, trial[1] as number, trial[2] as number)
    if (!rs.every((r) => r === allowed)) return false
    if (leftWindowCherry(i0)) return false
    // ベル/ピエロ等の小役引き込みではボーナス図柄テンパイを出さない
    // （allowed がボーナスのときはテンパイOK＝狙って揃える途中形）
    if (allowed !== 'BIG' && allowed !== 'REG' && isBonusTempai(lines, i0, trial[1] as number, trial[2] as number)) {
      return false
    }
    return true
  }
  for (let idx = 0; idx < L; idx++) {
    if (symbolAt(j, idx + l[j]) !== targetOf(j)) continue
    trial[j] = idx
    const ok = finishable(l, trial, targetOf, allowed, lines)
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
  lines: LineSet,
): number | null {
  const safetyTbl = tables(safety, lines)
  const isFinal = stopped.filter((s) => s !== null).length === 2
  for (let slip = 0; slip <= MAX_SLIP; slip++) {
    const idx = norm(cur - slip)
    for (const l of lines) {
      if (symbolAt(reel, idx + l[reel]) !== targetOf(reel)) continue
      const live = stopped.every((s, j) => j === reel || s === null || symbolAt(j, s + l[j]) === targetOf(j))
      if (!live) continue
      const trial = [...stopped]
      trial[reel] = idx
      if (!finishable(l, trial, targetOf, allowed, lines)) continue
      // 完成前の停止は、以降どう押されても安全条件へ逃げられる位置に限る
      if (!isFinal && !stateOK(safetyTbl, reel, idx, stopped)) continue
      return idx
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// チェリーフラグ専用テーブル（実機の「成立役引き込み最優先」の再現）
//
// 左リールが物理的に角チェリーを表示できる押し位置で押された場合、
// どの押し順でも必ず表示できることを保証する。そのため中・右リールは
// 「左のチェリー表示可能性を壊さない」位置にだけ止める。
// ---------------------------------------------------------------------------

interface CherryTables {
  /** okC[(s*21+b)*21+c]: 角チェリー表示＋全ライン無成立 */
  okC: Uint8Array
  /** okQ: チェリー中段以外＋全ライン無成立（表示なし側の合法形） */
  okQ: Uint8Array
  /** pair0[b*21+c]: 中・右停止済みで左が未停止。どこを押されても左が合法に止まれるか */
  pair0: Uint8Array
  /** pair1[s*21+c]: 左・右停止済みで中が未停止 */
  pair1: Uint8Array
  /** pair2[s*21+b]: 左・中停止済みで右が未停止 */
  pair2: Uint8Array
  single: [Uint8Array, Uint8Array, Uint8Array]
  /** 角チェリーを表示できる左停止位置 */
  corner: Uint8Array
  /** physCatch[p]: 押し位置pから角チェリー表示が物理的に可能か */
  phys: Uint8Array
  root: boolean
}

let cherryCache: CherryTables | null = null

function cherryTables(): CherryTables {
  if (cherryCache) return cherryCache
  const lines = LINES
  // チェリー制御中も通常時なのでボーナス図柄テンパイは出さない
  const quiet3 = (s: number, b: number, c: number) =>
    rawResults(lines, s, b, c).length === 0 && !isBonusTempai(lines, s, b, c)
  const corner = new Uint8Array(L)
  for (let s = 0; s < L; s++) corner[s] = leftWindowCherry(s) && !leftCenterCherry(s) ? 1 : 0
  const phys = new Uint8Array(L)
  for (let p = 0; p < L; p++) {
    for (let slip = 0; slip <= MAX_SLIP; slip++) if (corner[norm(p - slip)]) phys[p] = 1
  }

  const okC = new Uint8Array(L * L * L)
  const okQ = new Uint8Array(L * L * L)
  for (let s = 0; s < L; s++) {
    const isCorner = corner[s] === 1
    const isCenter = leftCenterCherry(s)
    for (let b = 0; b < L; b++) {
      for (let c = 0; c < L; c++) {
        const q = quiet3(s, b, c) ? 1 : 0
        okC[(s * L + b) * L + c] = isCorner ? q : 0
        okQ[(s * L + b) * L + c] = !isCenter ? q : 0
      }
    }
  }

  const good = new Uint8Array(L)
  // pair1: 左s・右c停止済み → 中はどこを押されても静かに止まれるか
  const pair1 = new Uint8Array(L * L)
  // pair2: 左s・中b停止済み → 右はどこを押されても静かに止まれるか
  const pair2 = new Uint8Array(L * L)
  for (let s = 0; s < L; s++) {
    for (let x = 0; x < L; x++) {
      for (let m = 0; m < L; m++) good[m] = okQ[(s * L + m) * L + x]
      pair1[s * L + x] = coveredByWindows(good) ? 1 : 0
      for (let r = 0; r < L; r++) good[r] = okQ[(s * L + x) * L + r]
      pair2[s * L + x] = coveredByWindows(good) ? 1 : 0
    }
  }
  // pair0: 中b・右c停止済み → 左がどこを押されても、
  //   表示可能な押し位置なら角チェリーを表示して、不可能なら非表示で止まれるか
  const pair0 = new Uint8Array(L * L)
  for (let b = 0; b < L; b++) {
    for (let c = 0; c < L; c++) {
      let ok = true
      for (let p = 0; p < L && ok; p++) {
        let found = false
        for (let slip = 0; slip <= MAX_SLIP && !found; slip++) {
          const s = norm(p - slip)
          if (phys[p]) {
            if (corner[s] && okC[(s * L + b) * L + c]) found = true
          } else {
            if (!leftWindowCherry(s) && okQ[(s * L + b) * L + c]) found = true
          }
        }
        if (!found) ok = false
      }
      pair0[b * L + c] = ok ? 1 : 0
    }
  }

  // single: 1リール停止時、残り2リールがどの順・どこを押されても守れるか
  const single: [Uint8Array, Uint8Array, Uint8Array] = [
    new Uint8Array(L),
    new Uint8Array(L),
    new Uint8Array(L),
  ]
  for (let s = 0; s < L; s++) {
    if (leftCenterCherry(s)) continue
    for (let m = 0; m < L; m++) good[m] = pair2[s * L + m]
    const okMid = coveredByWindows(good)
    for (let c = 0; c < L; c++) good[c] = pair1[s * L + c]
    single[0][s] = okMid && coveredByWindows(good) ? 1 : 0
  }
  /** 左が未停止のとき、全押し位置で左が合法に止まれて after が守れるか */
  const leftCoverable = (after: (s: number) => number): boolean => {
    for (let p = 0; p < L; p++) {
      let found = false
      for (let slip = 0; slip <= MAX_SLIP && !found; slip++) {
        const s = norm(p - slip)
        if (phys[p]) {
          if (corner[s] && after(s)) found = true
        } else {
          if (!leftWindowCherry(s) && after(s)) found = true
        }
      }
      if (!found) return false
    }
    return true
  }
  for (let v = 0; v < L; v++) {
    const leftOk1 = leftCoverable((s) => pair2[s * L + v])
    for (let c = 0; c < L; c++) good[c] = pair0[v * L + c]
    single[1][v] = leftOk1 && coveredByWindows(good) ? 1 : 0

    const leftOk2 = leftCoverable((s) => pair1[s * L + v])
    for (let b = 0; b < L; b++) good[b] = pair0[b * L + v]
    single[2][v] = leftOk2 && coveredByWindows(good) ? 1 : 0
  }

  const root =
    leftCoverable((s) => single[0][s] === 1 ? 1 : 0) &&
    coveredByWindows(single[1]) &&
    coveredByWindows(single[2])

  cherryCache = { okC, okQ, pair0, pair1, pair2, single, corner, phys, root }
  return cherryCache
}

/** チェリーフラグ時：この停止で以降も表示保証を守れるか */
function cherryStateOK(
  ct: CherryTables,
  reel: number,
  idx: number,
  stopped: ReadonlyArray<number | null>,
): boolean {
  const t: (number | null)[] = [...stopped]
  t[reel] = idx
  const known = t.filter((v) => v !== null).length
  if (known === 3) {
    return ct.okQ[((t[0] as number) * L + (t[1] as number)) * L + (t[2] as number)] === 1
  }
  if (known === 2) {
    if (t[0] === null) return ct.pair0[(t[1] as number) * L + (t[2] as number)] === 1
    if (t[1] === null) return ct.pair1[(t[0] as number) * L + (t[2] as number)] === 1
    return ct.pair2[(t[0] as number) * L + (t[1] as number)] === 1
  }
  return ct.single[reel][idx] === 1
}

/**
 * 停止制御。ビタ押し位置 cur に対し、内部フラグに応じた停止位置を返す。
 * stopped は各リールの停止index（未停止・自分自身は null）。
 * bet は賭け枚数（3枚=5ライン、1枚=中段のみ）。
 */
export function resolveStop(
  reel: number,
  cur: number,
  flag: Flag,
  pendingBonus: BonusKind | null,
  stopped: ReadonlyArray<number | null>,
  bet = 3,
): number {
  cur = norm(cur)
  const lines = activeLines(bet)

  if (pendingBonus) {
    // 中段チェリー成立ゲーム：左リール中段チェリーのプレミアム出目を最優先
    if (flag.midCherry) {
      const mid = tableStop('MIDC', reel, cur, stopped, lines)
      if (mid !== null) return mid
      if (reel === 0) {
        const corner = tableStop('CH_CORNER', reel, cur, stopped, lines)
        if (corner !== null) return corner
      }
      return tableStop('QUIET', reel, cur, stopped, lines) ?? cur
    }
    const safety: PredName = pendingBonus === 'BIG' ? 'BSAFE_BIG' : 'BSAFE_REG'
    const hit = greedyPull(reel, cur, (j) => bonusTarget(pendingBonus, j), pendingBonus, stopped, safety, lines)
    if (hit !== null) return hit
    return tableStop(safety, reel, cur, stopped, lines) ?? cur
  }

  switch (flag.role) {
    case 'GRAPE':
    case 'REPLAY':
      // 100%引き込み役：テーブルが全押し順・全押し位置で成立を保証する
      return (
        tableStop(flag.role, reel, cur, stopped, lines) ??
        tableStop('NONE', reel, cur, stopped, lines) ??
        cur
      )
    case 'BELL':
    case 'CLOWN': {
      // 目押し必要役：届けば揃え、届かなければ完全に外す（取りこぼし）
      const role = flag.role
      const hit = greedyPull(reel, cur, () => role, role, stopped, 'NONE', lines)
      if (hit !== null) return hit
      return tableStop('NONE', reel, cur, stopped, lines) ?? cur
    }
    case 'CHERRY': {
      // 成立役引き込み最優先（実機同様）：
      // 左リールは届く押し位置なら押し順に関わらず必ず角チェリーを表示する。
      // 中・右リールは左のチェリー表示可能性を壊さない位置にだけ止める。
      // 1枚がけは中段のみ有効なので角チェリーは狙わない
      if (bet >= 3) {
        const ct = cherryTables()
        if (reel === 0) {
          // 第1候補：角チェリー表示
          for (let slip = 0; slip <= MAX_SLIP; slip++) {
            const idx = norm(cur - slip)
            if (ct.corner[idx] && cherryStateOK(ct, 0, idx, stopped)) return idx
          }
          // 届かない押し位置：チェリーを見せずに取りこぼし
          for (let slip = 0; slip <= MAX_SLIP; slip++) {
            const idx = norm(cur - slip)
            if (!leftWindowCherry(idx) && cherryStateOK(ct, 0, idx, stopped)) return idx
          }
        } else {
          for (let slip = 0; slip <= MAX_SLIP; slip++) {
            const idx = norm(cur - slip)
            if (cherryStateOK(ct, reel, idx, stopped)) return idx
          }
        }
      }
      return tableStop('QUIET', reel, cur, stopped, lines) ?? cur
    }
    case 'BIG':
    case 'REG': {
      // pendingBonus 側で処理されるためここには来ないが、保険
      const safety: PredName = flag.role === 'BIG' ? 'BSAFE_BIG' : 'BSAFE_REG'
      const hit = greedyPull(reel, cur, (j) => bonusTarget(flag.role as BonusKind, j), flag.role, stopped, safety, lines)
      if (hit !== null) return hit
      return tableStop(safety, reel, cur, stopped, lines) ?? cur
    }
    default:
      return tableStop('NONE', reel, cur, stopped, lines) ?? cur
  }
}

/** 配列検証用：全述語テーブルが全押し順・全押し位置で成立可能か（3枚/1枚がけ両方） */
export function verifyStripDesign(): Record<string, boolean> {
  const names: PredName[] = ['NONE', 'GRAPE', 'REPLAY', 'QUIET']
  const out: Record<string, boolean> = {}
  for (const bet of [3, 1]) {
    for (const n of names) out[`${n}:${bet}bet`] = tables(n, activeLines(bet)).root
  }
  // チェリー引き込み最優先の保証（全押し順・全押し位置でBAR狙いのチェリーを表示できるか）
  out['CHERRY_PRIORITY'] = cherryTables().root
  return out
}
