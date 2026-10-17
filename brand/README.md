# Brand assets

Mark: a record (vinyl dot) at the centre with three links radiating out, in a coral rounded square. Wordmark is Instrument Serif; body copy is DM Sans (same as `src/styles.css`).

| Token | Hex | Source (oklch in `src/styles.css`) |
| --- | --- | --- |
| Coral (primary) | `#d95737` | `--primary` |
| Off-white | `#fbfaf7` | `--background` |
| Ink | `#1a1512` | `--foreground` |
| Muted text | `#68625e` | `--muted-foreground` |
| Peach tint | `#feeae1` | `--accent` |

## Files (all in `public/`)

- `logo.svg` mark + wordmark (text uses a Georgia fallback when Instrument Serif is not installed)
- `favicon.svg` mark only; `favicon.ico` (16/32/48), `favicon-16.png`, `favicon-32.png`
- `apple-touch-icon.png` 180x180, full-bleed (iOS rounds it)
- `icon-192.png`, `icon-512.png`, `site.webmanifest`
- `og.png` 1200x630, rendered from `brand/og.html`

## Regenerate

`CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`, run from the repo root.

OG image (needs network for Google Fonts, otherwise falls back to Georgia/system sans):

```sh
"$CH" --headless --screenshot=public/og.png --window-size=1200,630 \
  --hide-scrollbars --virtual-time-budget=8000 "file://$PWD/brand/og.html"
```

Icons: render `public/favicon.svg` to a 512px transparent PNG, then downscale with PIL (Lanczos).

```sh
echo "<body style='margin:0;background:transparent'><img src='file://$PWD/public/favicon.svg' width=512 height=512 style='display:block'>" > /tmp/icon.html
"$CH" --headless --screenshot=/tmp/icon-512.png --window-size=512,512 \
  --default-background-color=00000000 --hide-scrollbars /tmp/icon.html
python3 -c "
from PIL import Image
r = Image.open('/tmp/icon-512.png').convert('RGBA')
r.save('public/icon-512.png'); r.resize((192,192), Image.LANCZOS).save('public/icon-192.png')
r.resize((32,32), Image.LANCZOS).save('public/favicon-32.png'); r.resize((16,16), Image.LANCZOS).save('public/favicon-16.png')
ims = [r.resize((n,n), Image.LANCZOS) for n in (48,32,16)]
ims[0].save('public/favicon.ico', sizes=[(16,16),(32,32),(48,48)], append_images=ims[1:])
"
```

For `apple-touch-icon.png`, render a copy of the SVG with `rx="0"` (square corners, no transparency) and resize to 180x180 as RGB. For the sharpest 16/32px favicons, the mark was scaled up ~1.2x inside the square before downscaling.
