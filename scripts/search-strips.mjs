// リール配列の探索ツール（停止テーブル方式）。
// 実機構造の制約（チェリー付BAR・7の直下BAR等）を固定しつつ、
// 「どの押し順・どの押し位置でも」
//   - ハズレ時に何も揃わない（チェリー非表示含む）
//   - ぶどう/リプレイは必ずそれのみが揃う
//   - チェリーフラグ時に他役が揃わない
// を保証できる配列を探す。
// 実行: node scripts/search-strips.mjs [シード] [試行数]

const L = 21
const MAX_SLIP = 4
const LINES = [
  [0, 0, 0],
  [-1, -1, -1],
  [1, 1, 1],
  [-1, 0, 1],
  [1, 0, -1],
]

let S = null // [3][21] シンボル: 7,BAR,G,CH,BE,CL,RP
const norm = (i) => ((i % L) + L) % L
const sym = (r, i) => S[r][norm(i)]

function evalLine3(a, b, c) {
  if (a === '7' && b === '7' && c === '7') return 'BIG'
  if (a === '7' && b === '7' && c === 'BAR') return 'REG'
  if (a === b && b === c) return a
  return null
}

const winCh = (i0) => sym(0, i0 - 1) === 'CH' || sym(0, i0) === 'CH' || sym(0, i0 + 1) === 'CH'
const centerCh = (i0) => sym(0, i0) === 'CH'

function rawResults(a, b, c) {
  const out = []
  for (const l of LINES) {
    const r = evalLine3(sym(0, a + l[0]), sym(1, b + l[1]), sym(2, c + l[2]))
    if (r !== null) out.push(r)
  }
  return out
}

const PREDS = {
  NONE: (a, b, c) => {
    const rs = rawResults(a, b, c)
    return rs.length === 0 && !winCh(a)
  },
  G: (a, b, c) => {
    const rs = rawResults(a, b, c)
    return rs.length > 0 && rs.every((r) => r === 'G') && !winCh(a)
  },
  RP: (a, b, c) => {
    const rs = rawResults(a, b, c)
    return rs.length > 0 && rs.every((r) => r === 'RP') && !winCh(a)
  },
  QUIET: (a, b, c) => rawResults(a, b, c).length === 0 && !centerCh(a),
}

function covered(good) {
  let run = 0
  for (let i = 0; i < L * 2; i++) {
    if (good[i % L]) run = 0
    else if (++run >= MAX_SLIP + 1) return false
  }
  return true
}

/** 述語のroot成立（全押し順・全押し位置で維持可能）を判定 */
function rootOf(pred) {
  const ok3 = new Uint8Array(L * L * L)
  for (let a = 0; a < L; a++)
    for (let b = 0; b < L; b++)
      for (let c = 0; c < L; c++) ok3[(a * L + b) * L + c] = pred(a, b, c) ? 1 : 0

  const pair = [new Uint8Array(L * L), new Uint8Array(L * L), new Uint8Array(L * L)]
  const good = new Uint8Array(L)
  for (let m = 0; m < 3; m++) {
    for (let a = 0; a < L; a++) {
      for (let b = 0; b < L; b++) {
        for (let c = 0; c < L; c++) {
          const t = m === 0 ? [c, a, b] : m === 1 ? [a, c, b] : [a, b, c]
          good[c] = ok3[(t[0] * L + t[1]) * L + t[2]]
        }
        pair[m][a * L + b] = covered(good) ? 1 : 0
      }
    }
  }

  const single = [new Uint8Array(L), new Uint8Array(L), new Uint8Array(L)]
  for (let held = 0; held < 3; held++) {
    const others = [0, 1, 2].filter((r) => r !== held)
    for (let v = 0; v < L; v++) {
      let ok = true
      for (const u of others) {
        const third = others.find((r) => r !== u)
        for (let c = 0; c < L; c++) {
          const [x, y] = held < u ? [v, c] : [c, v]
          good[c] = pair[third][x * L + y]
        }
        if (!covered(good)) {
          ok = false
          break
        }
      }
      single[held][v] = ok ? 1 : 0
    }
  }

  for (let held = 0; held < 3; held++) {
    if (!covered(single[held])) return false
  }
  return true
}

// --- 生成 ---
let seed = Number(process.argv[2] ?? 1)
const MAX_TRIES = Number(process.argv[3] ?? 500000)
function rnd() {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function gapsOk(strip, target, maxGap) {
  const pos = []
  for (let i = 0; i < L; i++) if (strip[i] === target) pos.push(i)
  if (pos.length === 0) return false
  for (let i = 0; i < pos.length; i++) {
    const gap = i + 1 < pos.length ? pos[i + 1] - pos[i] : pos[0] + L - pos[i]
    if (gap > maxGap) return false
  }
  return true
}

/** 左リール：チェリー付BAR(2,3 / 13,14)・7(10,20)固定、残りをシャッフル */
function genLeft() {
  const strip = new Array(L).fill(null)
  strip[2] = 'CH'
  strip[3] = 'BAR'
  strip[13] = 'CH'
  strip[14] = 'BAR'
  strip[10] = '7'
  strip[20] = '7'
  const fill = shuffle(['G', 'G', 'G', 'G', 'G', 'G', 'G', 'RP', 'RP', 'RP', 'RP', 'RP', 'RP', 'BE', 'CL'])
  for (let i = 0, k = 0; i < L; i++) if (strip[i] === null) strip[i] = fill[k++]
  return strip
}

/** 中リール：7×1固定位置なし、自由配置 */
function genMid() {
  return shuffle([
    '7', 'BAR', 'BAR', 'CH', 'CH', 'BE', 'CL',
    'G', 'G', 'G', 'G', 'G', 'G', 'G',
    'RP', 'RP', 'RP', 'RP', 'RP', 'RP', 'RP',
  ])
}

/** 右リール：7の直下にBAR×2、他は自由配置 */
function genRight() {
  const strip = new Array(L).fill(null)
  const p1 = Math.floor(rnd() * L)
  let p2
  do {
    p2 = Math.floor(rnd() * L)
  } while ([p1, norm(p1 + 1), norm(p1 - 1)].includes(p2) || [p1, norm(p1 + 1)].includes(norm(p2 + 1)))
  strip[p1] = '7'
  strip[norm(p1 + 1)] = 'BAR'
  strip[p2] = '7'
  strip[norm(p2 + 1)] = 'BAR'
  const fill = shuffle(['G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'RP', 'RP', 'RP', 'RP', 'RP', 'RP', 'CH', 'BE', 'CL'])
  for (let i = 0, k = 0; i < L; i++) if (strip[i] === null) strip[i] = fill[k++]
  return strip
}

function structureOk() {
  for (const s of S) {
    if (!gapsOk(s, 'G', 5) || !gapsOk(s, 'RP', 5)) return false
  }
  // 左：BAR狙い(押し位置=BAR±1)で7が引き込みスパン(7コマ)に入る
  for (const bar of [3, 14]) {
    let ok = false
    for (let d = 1; d >= -5; d--) if (sym(0, bar + d) === '7') ok = true
    if (!ok) return false
  }
  // 中：7が窓に入り得る押し位置が存在し、かつ入らない位置もある（目押し性）
  return true
}

const t0 = Date.now()
let tries = 0
let passStruct = 0
const failCount = { NONE: 0, G: 0, RP: 0, QUIET: 0 }
for (; tries < MAX_TRIES; ) {
  tries++
  S = [genLeft(), genMid(), genRight()]
  if (!structureOk()) continue
  passStruct++
  let ok = true
  for (const name of ['G', 'NONE', 'RP', 'QUIET']) {
    if (!rootOf(PREDS[name])) {
      failCount[name]++
      ok = false
      break
    }
  }
  if (!ok) continue
  console.log(`FOUND after ${tries} tries (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
  const name = { G: 'GRAPE', RP: 'REPLAY', CH: 'CHERRY', BE: 'BELL', CL: 'CLOWN', 7: 'STAR', BAR: 'BAR' }
  for (let r = 0; r < 3; r++) {
    console.log(`reel${r}: [${S[r].map((s) => `'${name[s]}'`).join(', ')}],`)
  }
  process.exit(0)
}
console.log(`NOT FOUND: tries=${tries} struct-pass=${passStruct} fails=`, failCount, `${((Date.now() - t0) / 1000).toFixed(1)}s`)
