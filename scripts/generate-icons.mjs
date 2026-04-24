import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, '..', 'public', 'icon');
mkdirSync(outputDir, { recursive: true });

// 128×128 viewBox.
// Background: orange gradient matching Strava.
// Icon: Material Design thumbs-up (24×24 path) scaled to fill the badge.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF6D00"/>
      <stop offset="100%" stop-color="#BF360C"/>
    </linearGradient>
  </defs>

  <!-- Rounded-square background -->
  <rect width="128" height="128" rx="22" fill="url(#g)"/>

  <!-- Thumbs-up   (Material Design path, 24×24 → scaled ×3.5, centred) -->
  <g transform="translate(24,23) scale(3.5)" fill="white">
    <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57
             .03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59
             C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9
             c.83 0 1.54-.5 1.84-1.22l3.02-7.05
             c.09-.23.14-.47.14-.73v-2z"/>
  </g>
</svg>`;

// Write master SVG alongside the PNGs (useful as source-of-truth)
writeFileSync(join(outputDir, 'icon.svg'), svg, 'utf8');

const sizes = [16, 32, 48, 96, 128];

for (const size of sizes) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(join(outputDir, `${size}.png`));
  console.log(`✓ ${size}.png`);
}

console.log('\nAll icons generated in public/icon/');

