// One-off: rasterize PWA icons + apple-touch-icon + OG image from the brand mark.
// Run: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'

const tile = (size, pad = 0) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
  <rect width="64" height="64" rx="${pad ? 0 : 13}" fill="#0b0e14"/>
  <path d="M17 21 L31 32 L17 43" fill="none" stroke="#22d3ee" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="36" y="40" width="13" height="6" rx="2" fill="#22d3ee"/>
</svg>`)

// Maskable: full-bleed background, glyph shrunk into the safe zone
const maskable = (size) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
  <rect width="64" height="64" fill="#0b0e14"/>
  <g transform="translate(8.96 8.96) scale(0.72)">
    <path d="M17 21 L31 32 L17 43" fill="none" stroke="#22d3ee" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="36" y="40" width="13" height="6" rx="2" fill="#22d3ee"/>
  </g>
</svg>`)

const og = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#0b0e14"/>
  <rect x="40" y="40" width="1120" height="550" fill="#0f131b" stroke="#1b2233" stroke-width="2"/>
  <circle cx="92" cy="92" r="9" fill="#f7768e" opacity="0.6"/>
  <circle cx="124" cy="92" r="9" fill="#e0af68" opacity="0.6"/>
  <circle cx="156" cy="92" r="9" fill="#9ece6a" opacity="0.6"/>
  <text x="100" y="300" font-family="Consolas, Courier New, monospace" font-size="84" font-weight="bold" fill="#22d3ee">~/lc-tracker</text>
  <text x="100" y="380" font-family="Consolas, Courier New, monospace" font-size="34" fill="#c8d3f5">&#10095; spaced repetition for problem grinding</text>
  <text x="100" y="470" font-family="Consolas, Courier New, monospace" font-size="26" fill="#545c7e">weekly leaderboard &#183; streaks &#183; grind with friends</text>
</svg>`)

await sharp(tile(192)).png().toFile('public/icon-192.png')
await sharp(tile(512)).png().toFile('public/icon-512.png')
await sharp(maskable(512)).png().toFile('public/icon-maskable-512.png')
await sharp(tile(180)).png().toFile('public/apple-touch-icon.png')
await sharp(og).png().toFile('public/og.png')
console.log('icons + og image written to public/')
