// 白背景に図柄が並んだ一覧画像から各図柄を切り出し、
// src/assets/symbols/ に透過PNGとして出力する。
// 実行: node scripts/extract-symbols-white.mjs <画像>
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = process.argv[2]
if (!src) {
  console.error('usage: node scripts/extract-symbols-white.mjs <image.png>')
  process.exit(1)
}
const symDir = join(root, 'src', 'assets', 'symbols')
mkdirSync(symDir, { recursive: true })

const meta = await sharp(src).metadata()
const W = meta.width
const H = meta.height

// [name, x0, y0, x1, y1]（1662x946 基準の比率）
const CELLS = [
  ['BELL', 0.02, 0.16, 0.27, 0.50],
  ['REPLAY', 0.27, 0.16, 0.50, 0.50],
  ['GRAPE', 0.50, 0.16, 0.73, 0.50],
  ['CHERRY', 0.72, 0.16, 0.99, 0.50],
  ['STAR', 0.01, 0.52, 0.36, 0.86],
  ['BAR', 0.34, 0.55, 0.66, 0.83],
  ['CLOWN', 0.68, 0.52, 0.96, 0.86],
]

/** 外周から連結した白領域だけを透過にする（図柄内部のハイライトは残す） */
function floodFillWhite(data, w, h) {
  const isWhite = (i) => data[i] > 232 && data[i + 1] > 232 && data[i + 2] > 232
  const visited = new Uint8Array(w * h)
  const queue = []
  for (let x = 0; x < w; x++) queue.push(x, (h - 1) * w + x)
  for (let y = 0; y < h; y++) queue.push(y * w, y * w + (w - 1))
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
  // 透過に接する明るい縁を半透明にして白フチのにじみを消す
  for (let p = 0; p < w * h; p++) {
    const i = p * 4
    if (data[i + 3] === 0) continue
    const x = p % w
    const y = (p / w) | 0
    const nearClear =
      (x > 0 && data[(p - 1) * 4 + 3] === 0) ||
      (x < w - 1 && data[(p + 1) * 4 + 3] === 0) ||
      (y > 0 && data[(p - w) * 4 + 3] === 0) ||
      (y < h - 1 && data[(p + w) * 4 + 3] === 0)
    if (nearClear && data[i] > 214 && data[i + 1] > 214 && data[i + 2] > 214) {
      data[i + 3] = 96
    }
  }
}

/** 最大成分より十分小さい連結成分（隣図柄のはみ出し等）を除去 */
function removeSmallFragments(data, w, h) {
  const labels = new Int32Array(w * h).fill(-1)
  const sizes = []
  for (let start = 0; start < w * h; start++) {
    if (labels[start] !== -1 || data[start * 4 + 3] <= 12) continue
    const id = sizes.length
    let size = 0
    const stack = [start]
    labels[start] = id
    while (stack.length) {
      const p = stack.pop()
      size++
      const x = p % w
      const y = (p / w) | 0
      for (const [q, ok] of [
        [p - 1, x > 0],
        [p + 1, x < w - 1],
        [p - w, y > 0],
        [p + w, y < h - 1],
      ]) {
        if (ok && labels[q] === -1 && data[q * 4 + 3] > 12) {
          labels[q] = id
          stack.push(q)
        }
      }
    }
    sizes.push(size)
  }
  const largest = Math.max(...sizes, 1)
  for (let p = 0; p < w * h; p++) {
    const id = labels[p]
    if (id !== -1 && sizes[id] < largest * 0.06) data[p * 4 + 3] = 0
  }
}

function alphaBBox(data, w, h) {
  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 12) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return maxX < 0 ? null : { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

for (const [name, x0, y0, x1, y1] of CELLS) {
  const left = Math.round(x0 * W)
  const top = Math.round(y0 * H)
  const width = Math.round((x1 - x0) * W)
  const height = Math.round((y1 - y0) * H)
  const { data, info } = await sharp(src)
    .extract({ left, top, width, height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  floodFillWhite(data, info.width, info.height)
  removeSmallFragments(data, info.width, info.height)
  const box = alphaBBox(data, info.width, info.height)
  if (!box) {
    console.warn(`WARN: ${name} empty`)
    continue
  }
  // パディングせず自然な縦横比のまま、長辺160pxに収める
  // （表示側は objectFit:contain で縦横比を保って配置する）
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract(box)
    .resize({ width: 160, height: 160, fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toFile(join(symDir, `${name}.png`))
  console.log(`generated ${name}.png (${box.width}x${box.height})`)
}
console.log('done')
