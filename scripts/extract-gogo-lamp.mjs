// GOGO!ランプ画像（左=消灯・右=点灯、白背景）から2状態を切り出して
// src/assets/ に透過PNGとして出力する。
// 実行: node scripts/extract-gogo-lamp.mjs <画像>
import sharp from 'sharp'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = process.argv[2]
if (!src) {
  console.error('usage: node scripts/extract-gogo-lamp.mjs <image.png>')
  process.exit(1)
}

const meta = await sharp(src).metadata()
const W = meta.width
const H = meta.height

// [name, x0, y0, x1, y1]（見出しテキストを除いた領域）
const CELLS = [
  ['gogo-off', 0.01, 0.14, 0.5, 1.0],
  ['gogo-on', 0.5, 0.14, 1.0, 1.0],
]

function floodFillWhite(data, w, h, threshold) {
  const isBg = (i) => data[i] > threshold && data[i + 1] > threshold && data[i + 2] > threshold
  const visited = new Uint8Array(w * h)
  const queue = []
  for (let x = 0; x < w; x++) queue.push(x, (h - 1) * w + x)
  for (let y = 0; y < h; y++) queue.push(y * w, y * w + (w - 1))
  while (queue.length) {
    const p = queue.pop()
    if (visited[p]) continue
    visited[p] = 1
    const i = p * 4
    if (!isBg(i)) continue
    data[i + 3] = 0
    const x = p % w
    const y = (p / w) | 0
    if (x > 0) queue.push(p - 1)
    if (x < w - 1) queue.push(p + 1)
    if (y > 0) queue.push(p - w)
    if (y < h - 1) queue.push(p + w)
  }
  // 透過に接する明るい縁をなじませる
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
    if (nearClear && data[i] > threshold - 25 && data[i + 1] > threshold - 25 && data[i + 2] > threshold - 25) {
      data[i + 3] = 110
    }
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

const boxes = []
for (const [name, x0, y0, x1, y1] of CELLS) {
  const left = Math.round(x0 * W)
  const top = Math.round(y0 * H)
  const width = Math.min(Math.round((x1 - x0) * W), W - left)
  const height = Math.min(Math.round((y1 - y0) * H), H - top)
  const { data, info } = await sharp(src)
    .extract({ left, top, width, height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  // 点灯側はグロー（薄い青白）を残したいので閾値を高めに
  floodFillWhite(data, info.width, info.height, name === 'gogo-on' ? 246 : 236)
  const box = alphaBBox(data, info.width, info.height)
  boxes.push({ name, data, info, box })
}

// 2状態を同じ縦横比・同じ余白で書き出す（切替時にズレないように）
for (const { name, data, info, box } of boxes) {
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract(box)
    .resize({ width: 360, height: 320, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(join(root, 'src', 'assets', `${name}.png`))
  console.log(`generated ${name}.png (${box.width}x${box.height})`)
}
console.log('done')
