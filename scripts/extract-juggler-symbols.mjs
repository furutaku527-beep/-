// リール図柄画像（黒いドラム上に図柄が並んだ紹介画像）から各図柄を切り出して
// src/assets/symbols/ に透過PNGとして出力する。
// 実行: node scripts/extract-juggler-symbols.mjs <入力画像>
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = process.argv[2]
if (!src) {
  console.error('usage: node scripts/extract-juggler-symbols.mjs <image.png>')
  process.exit(1)
}
const symDir = join(root, 'src', 'assets', 'symbols')
mkdirSync(symDir, { recursive: true })

const meta = await sharp(src).metadata()
const W = meta.width
const H = meta.height

// 各図柄のドラム内側領域（1380x752 基準の比率で指定）
const CELLS = [
  // [name, x0, y0, x1, y1]
  ['STAR', 0.105, 0.195, 0.355, 0.465],
  ['CLOWN', 0.67, 0.195, 0.92, 0.465],
  ['CHERRY', 0.058, 0.59, 0.258, 0.855],
  ['BELL', 0.29, 0.59, 0.49, 0.855],
  ['GRAPE', 0.525, 0.59, 0.725, 0.855],
  ['REPLAY', 0.757, 0.59, 0.957, 0.855],
]

// BARは黒プレート自体が図柄なのでフラッドフィルせず、プレート領域を角丸で切り出す
const BAR_BOX = [0.4217, 0.2487, 0.613, 0.403]

/** 外周から連結した暗い領域を透過にする（図柄内部の黒は白フチで囲まれているため残る） */
function floodFillDark(data, w, h) {
  const isDark = (i) => data[i] < 82 && data[i + 1] < 82 && data[i + 2] < 82
  const visited = new Uint8Array(w * h)
  const queue = []
  for (let x = 0; x < w; x++) queue.push(x, (h - 1) * w + x)
  for (let y = 0; y < h; y++) queue.push(y * w, y * w + (w - 1))
  while (queue.length) {
    const p = queue.pop()
    if (visited[p]) continue
    visited[p] = 1
    const i = p * 4
    if (!isDark(i)) continue
    data[i + 3] = 0
    const x = p % w
    const y = (p / w) | 0
    if (x > 0) queue.push(p - 1)
    if (x < w - 1) queue.push(p + 1)
    if (y > 0) queue.push(p - w)
    if (y < h - 1) queue.push(p + w)
  }
  // 透過に接する暗い縁を弱め、黒フチのにじみを消す
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
    if (nearClear && data[i] < 110 && data[i + 1] < 110 && data[i + 2] < 110) {
      data[i + 3] = Math.min(data[i + 3], 110)
    }
  }
}

/** 最大成分より十分小さい連結成分（ゴミ・飾り）を除去する */
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
    if (id !== -1 && sizes[id] < largest * 0.08) data[p * 4 + 3] = 0
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
  floodFillDark(data, info.width, info.height)
  removeSmallFragments(data, info.width, info.height)
  const box = alphaBBox(data, info.width, info.height)
  if (!box) {
    console.warn(`WARN: ${name} empty`)
    continue
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract(box)
    .resize({ width: 144, height: 144, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(join(symDir, `${name}.png`))
  console.log(`generated ${name}.png (${box.width}x${box.height})`)
}

// --- BAR: プレートを直接切り出して角丸マスク ---
{
  const [x0, y0, x1, y1] = BAR_BOX
  const left = Math.round(x0 * W)
  const top = Math.round(y0 * H)
  const width = Math.round((x1 - x0) * W)
  const height = Math.round((y1 - y0) * H)
  const r = Math.round(height * 0.1)
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
  )
  // composite は resize より後に適用されるため、角丸マスクを先に焼き込んでから縮小する
  const plate = await sharp(src)
    .extract({ left, top, width, height })
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
  await sharp(plate)
    .resize({ width: 144, height: 144, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(join(symDir, 'BAR.png'))
  console.log(`generated BAR.png (${width}x${height})`)
}
console.log('done')
