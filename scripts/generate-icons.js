import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const publicDir = path.resolve(__dirname, '../public')
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true })
}

// Crisp, high-end SVG icon for Habit Tracker
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d1117" />
      <stop offset="100%" stop-color="#161b22" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3ecf8e" />
      <stop offset="100%" stop-color="#1c7c54" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#3ecf8e" flood-opacity="0.35" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="512" height="512" rx="108" fill="url(#bgGrad)" />
  <rect x="2" y="2" width="508" height="508" rx="106" fill="none" stroke="#30363d" stroke-width="4" />

  <!-- Inner glowing emblem -->
  <rect x="96" y="96" width="320" height="320" rx="64" fill="url(#accentGrad)" filter="url(#glow)" />

  <!-- Checkmark glyph -->
  <path d="M190 256 L236 304 L328 196" fill="none" stroke="#0d1117" stroke-width="42" stroke-linecap="round" stroke-linejoin="round" />
</svg>
`

// Maskable icon requires safe area margin (80% inner content)
const svgMaskable = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#0d1117" />
  <g transform="translate(51.2, 51.2) scale(0.8)">
    <defs>
      <linearGradient id="mGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3ecf8e" />
        <stop offset="100%" stop-color="#1c7c54" />
      </linearGradient>
    </defs>
    <rect x="64" y="64" width="384" height="384" rx="80" fill="url(#mGrad)" />
    <path d="M180 256 L236 312 L332 196" fill="none" stroke="#0d1117" stroke-width="44" stroke-linecap="round" stroke-linejoin="round" />
  </g>
</svg>
`

async function generate() {
  const svgBuffer = Buffer.from(svgIcon)
  const maskableBuffer = Buffer.from(svgMaskable)

  // Save SVG
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgIcon)

  // 192x192
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'))

  // 512x512
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'))

  // Apple touch icon (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'))

  // Maskable 512x512
  await sharp(maskableBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'maskable-icon-512x512.png'))

  console.log('✓ Successfully generated all PWA icons in public/!')
}

generate().catch(err => {
  console.error(err)
  process.exit(1)
})
