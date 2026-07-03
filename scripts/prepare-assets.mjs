// AI生成画像素材を加工して src/assets/ に出力する。
// 入力: assets-src/{bg,marquee,bonus,sheet}.png（リポジトリには含めない）
// 実行: node scripts/prepare-assets.mjs [入力ディレクトリ]
import sharp from 'sharp'
import { mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = process.argv[2] ?? join(root, 'assets-src')
const outDir = join(root, 'src', 'assets')
const symDir = join(outDir, 'symbols')
mkdirSync(symDir, { recursive: true })

if (!existsSync(srcDir)) {
  console.error(`入力ディレクトリがありません: ${srcDir}`)
  process.exit(1)
}

// --- 背景系: リサイズ + WebP圧縮 ---
async function background(name, width, quality) {
  const src = join(srcDir, `${name}.png`)
  if (!existsSync(src)) {
    console.warn(`skip: ${name}.png がありません`)
    return
  }
  const out = join(outDir, `${name}.webp`)
  await sharp(src).resize({ width, withoutEnlargement: true }).webp({ quality }).toFile(out)
  console.log(`generated src/assets/${name}.webp`)
}

// --- 図柄シート: セル切り出し → 白背景を透過 → トリム → 正方形PNG ---
const SHEET_COLS = 5
const SHEET_ROWS = 3
// [シンボル名, 行, 列]
const CELLS = [
  ['STAR', 0, 0],
  ['BAR', 0, 1],
  ['GRAPE', 0, 2],
  ['CHERRY', 0, 3],
  ['BELL', 0, 4],
  ['CLOWN', 1, 3],
  ['REPLAY', 1, 4],
]

/** 外周から連結した白領域だけを透過にする（図柄内部のハイライトは残す） */
function floodFillWhite(data, w, h) {
  const isWhite = (i) => data[i] > 233 && data[i + 1] > 233 && data[i + 2] > 233
  const visited = new Uint8Array(w * h)
  const queue = []
  for (let x = 0; x < w; x++) {
    queue.push(x, (h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    queue.push(y * w, y * w + (w - 1))
  }
  while (queue.length) {
    const p = queue.pop()
    if (visited[p]) continue
    visited[p] = 1
    const i = p * 4
    if (!isWhite(i)) continue
    data[i + 3] = 0
    const x = p % w
    const y = (p / w) | 0
    if (x > 0) queue.push(p - 1)
    if (x < w - 1) queue.push(p + 1)
    if (y > 0) queue.push(p - w)
    if (y < h - 1) queue.push(p + w)
  }
  // 透過領域と接する明るい縁を半透明にして白フチを消す
  for (let p = 0; p < w * h; p++) {
    const i = p * 4
    if (data[i + 3] === 0) continue
    const x = p % w
    const y = (p / w) | 0
    const neighbors = [p - 1, p + 1, p - w, p + w].filter(
      (q, k) =>
        (k === 0 ? x > 0 : k === 1 ? x < w - 1 : k === 2 ? y > 0 : y < h - 1) && data[q * 4 + 3] === 0,
    )
    if (neighbors.length && data[i] > 215 && data[i + 1] > 215 && data[i + 2] > 215) {
      data[i + 3] = 90
    }
  }
}

/**
 * 隣セルからのはみ出し除去：セル外周に接していて、かつ最大成分より
 * 十分小さい連結成分を透明化する。
 */
function removeBorderFragments(data, w, h) {
  const labels = new Int32Array(w * h).fill(-1)
  const sizes = []
  const touches = []
  for (let start = 0; start < w * h; start++) {
    if (labels[start] !== -1 || data[start * 4 + 3] <= 8) continue
    const id = sizes.length
    let size = 0
    let touch = false
    const stack = [start]
    labels[start] = id
    while (stack.length) {
      const p = stack.pop()
      size++
      const x = p % w
      const y = (p / w) | 0
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touch = true
      for (const [q, ok] of [
        [p - 1, x > 0],
        [p + 1, x < w - 1],
        [p - w, y > 0],
        [p + w, y < h - 1],
      ]) {
        if (ok && labels[q] === -1 && data[q * 4 + 3] > 8) {
          labels[q] = id
          stack.push(q)
        }
      }
    }
    sizes.push(size)
    touches.push(touch)
  }
  const largest = Math.max(...sizes, 1)
  for (let p = 0; p < w * h; p++) {
    const id = labels[p]
    if (id !== -1 && touches[id] && sizes[id] < largest * 0.5) {
      data[p * 4 + 3] = 0
    }
  }
}

function alphaBBox(data, w, h) {
  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return maxX < 0 ? null : { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

async function extractSymbols() {
  const src = join(srcDir, 'sheet.png')
  if (!existsSync(src)) {
    console.warn('skip: sheet.png がありません')
    return
  }
  const meta = await sharp(src).metadata()
  const cw = Math.floor(meta.width / SHEET_COLS)
  const ch = Math.floor(meta.height / SHEET_ROWS)

  for (const [name, row, col] of CELLS) {
    const cell = sharp(src).extract({ left: col * cw, top: row * ch, width: cw, height: ch })
    const { data, info } = await cell.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    floodFillWhite(data, info.width, info.height)
    removeBorderFragments(data, info.width, info.height)
    const box = alphaBBox(data, info.width, info.height)
    if (!box) {
      console.warn(`WARN: ${name} が空になりました`)
      continue
    }
    const side = Math.max(box.width, box.height)
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .extract(box)
      .resize({
        width: 128,
        height: 128,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toFile(join(symDir, `${name}.png`))
    console.log(`generated src/assets/symbols/${name}.png (${box.width}x${box.height} → 128, pad from ${side})`)
  }
}

await background('bg', 1080, 70)
await background('marquee', 1200, 75)
await background('bonus', 900, 70)
await extractSymbols()
console.log('done')
