# App images

**Every file here is generated** — never hand-edit. The source is the brand
generator in the main repo:

```bash
cd ../taikan && TAIKAN_MOBILE_ROOT=/path/to/taikan-mobile pnpm brand:assets:all
```

| File | Used by | Notes |
|---|---|---|
| `icon.png` | `icon` (all iOS appearance modes + Android) | 1024², no alpha, square — the OS masks it |
| `adaptive-icon.png` | `android.adaptiveIcon.foregroundImage` | mark inside the 66/108 safe circle, on `#0E8C8C` |
| `adaptive-icon-mono.png` | `android.adaptiveIcon.monochromeImage` | white silhouette; Android 13 themed icons |
| `notification-icon.png` | `expo-notifications` | 96², white FLAT mark — Android discards gradients here |
| `splash.png` | `expo-splash-screen` + `animated-splash.tsx` | bare gradient mark, rendered at `imageWidth: 160` |
| `logo-mark.png` | legacy raster | prefer `<FKBrandMark>` (vector) |
| `mark.svg` | reference | canonical vector of the mark |

Icon and splash changes are **native** — they need `pnpm prebuild` and a new
build, not an OTA. Expo Go only ever shows the manifest icon.


## Why there's no separate iOS 18 dark/tinted icon

Tried `ios.icon.{light,dark,tinted}` — on a real TestFlight install the
`dark` slot rendered as a flat black square. Its artwork was transparent
(Apple's docs describe the OS supplying a plate behind it), but that
compositing is for a real layered Icon Composer asset, not a flat PNG in a
classic appearance slot; iOS just filled the alpha with black. The single
`icon.png` above (opaque) covers every appearance mode on its own — the
same one-icon-everywhere behavior every app had before iOS 18, and the one
place this can't regress.
