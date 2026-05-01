# PWA Icons

This directory contains PWA icons for CareerOps.

## Required PNG files

The following PNG files must be generated before production build:

- `icon-192.png` — 192×192px, indigo background (#6366F1) with white "C" logo
- `icon-512.png` — 512×512px, indigo background (#6366F1) with white "C" logo

## Generating PNGs from SVGs

Use one of the following approaches:

```bash
# Option 1: Using Inkscape (CLI)
inkscape icon-192.png.svg --export-type=png --export-filename=icon-192.png --export-width=192 --export-height=192
inkscape icon-512.png.svg --export-type=png --export-filename=icon-512.png --export-width=512 --export-height=512

# Option 2: Using sharp (Node.js)
npx @squoosh/cli --oxipng {} icon-192.png.svg

# Option 3: Using sharp script
node -e "
const sharp = require('sharp');
sharp('icon-192.png.svg').resize(192,192).png().toFile('icon-192.png');
sharp('icon-512.png.svg').resize(512,512).png().toFile('icon-512.png');
"
```

## Note
The SVG source files (`icon-192.png.svg`, `icon-512.png.svg`) are committed as references.
The actual `.png` files should be generated as part of the CI/CD pipeline before `vite build`.
