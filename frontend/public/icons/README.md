# PWA Icons

This directory contains the CareerOps PWA icons.

## Files
- `icon-192.svg` — Source SVG for 192×192 icon (indigo background + white "C")
- `icon-512.svg` — Source SVG for 512×512 icon (indigo background + white "C")

## Generating PNG files

The PNG files (`icon-192.png`, `icon-512.png`) need to be generated from the SVGs.
Run one of these methods:

### Using sharp / Node
```bash
npx sharp-cli -i icon-192.svg -o icon-192.png
npx sharp-cli -i icon-512.svg -o icon-512.png
```

### Using Inkscape (CLI)
```bash
inkscape icon-192.svg --export-type=png --export-filename=icon-192.png -w 192 -h 192
inkscape icon-512.svg --export-type=png --export-filename=icon-512.png -w 512 -h 512
```

### Using svgexport
```bash
npx svgexport icon-192.svg icon-192.png 192:192
npx svgexport icon-512.svg icon-512.png 512:512
```

The SVG files are valid standalone icons — browsers that support SVG favicons will use them directly.
For full PWA compliance on iOS/Android, the PNG files are required.
