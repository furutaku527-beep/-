// PWAアイコンの生成（4色カウントボタンをモチーフにしたSVG → PNG）
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="110" fill="#12151b"/>
  <rect x="86" y="86" width="160" height="160" rx="40" fill="#eef1f5"/>
  <rect x="266" y="86" width="160" height="160" rx="40" fill="#e5484d"/>
  <rect x="86" y="266" width="160" height="160" rx="40" fill="#46a758"/>
  <rect x="266" y="266" width="160" height="160" rx="40" fill="#f0c000"/>
</svg>
`

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]

for (const [name, size] of targets) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(outDir, name))
  console.log(`generated icons/${name} (${size}x${size})`)
}
