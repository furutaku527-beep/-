// PWA用アイコンを外部ライブラリなしで生成する（PNGを直接エンコード）。
// 実行: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// --- PNGエンコーダ ---
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})

function crc32(buf) {
  let c = -1
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  // 各行の先頭にフィルタタイプ0を付与
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- アイコン描画 ---
function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const lampR = size * 0.33

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const dx = x - cx
      const dy = y - cy
      const d = Math.hypot(dx, dy)

      // 背景：ダークネイビー（中心ほどわずかに明るく）
      let r = 18 + Math.max(0, 24 - (d / size) * 48)
      let g = 16 + Math.max(0, 20 - (d / size) * 40)
      let b = 42 + Math.max(0, 40 - (d / size) * 60)

      // ランプ本体（黄色い円、上左にハイライト）
      if (d < lampR) {
        const hx = x - (cx - lampR * 0.35)
        const hy = y - (cy - lampR * 0.35)
        const hd = Math.hypot(hx, hy) / lampR
        const glow = Math.max(0, 1 - hd * 0.75)
        r = 245 + glow * 10
        g = 180 + glow * 70
        b = 40 + glow * 140
      } else if (d < lampR * 1.12) {
        // リング
        r = 255
        g = 210
        b = 63
      }

      // 4方向のスパークル（十字の光）
      const sparkle =
        (Math.abs(dx) < size * 0.012 && Math.abs(dy) < lampR * 1.6) ||
        (Math.abs(dy) < size * 0.012 && Math.abs(dx) < lampR * 1.6)
      if (sparkle && d > lampR * 1.15) {
        const fade = 1 - d / (lampR * 1.7)
        if (fade > 0) {
          r = r + (255 - r) * fade
          g = g + (240 - g) * fade
          b = b + (180 - b) * fade
        }
      }

      px[i] = Math.min(255, Math.round(r))
      px[i + 1] = Math.min(255, Math.round(g))
      px[i + 2] = Math.min(255, Math.round(b))
      px[i + 3] = 255
    }
  }
  return px
}

const outDir = join(root, 'public', 'icons')
mkdirSync(outDir, { recursive: true })

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(join(outDir, name), encodePng(size, drawIcon(size)))
  console.log(`generated public/icons/${name}`)
}
