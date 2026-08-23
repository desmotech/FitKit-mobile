# App images

**Every file here is generated** — never hand-edit. The source is the brand
generator in the main repo:

```bash
cd ../taikan && TAIKAN_MOBILE_ROOT=/path/to/taikan-mobile pnpm brand:assets:all
```

| File | Used by | Notes |
|---|---|---|
| `icon.png` | `icon`, `ios.icon.light` | 1024², no alpha, square — the OS masks it |
| `icon-dark.png` | `ios.icon.dark` | mark on transparent; iOS 18 supplies the dark plate |
| `icon-tinted.png` | `ios.icon.tinted` | grayscale alpha mask; iOS 18 tints it |
| `adaptive-icon.png` | `android.adaptiveIcon.foregroundImage` | mark inside the 66/108 safe circle, on `#0E8C8C` |
| `adaptive-icon-mono.png` | `android.adaptiveIcon.monochromeImage` | white silhouette; Android 13 themed icons |
| `notification-icon.png` | `expo-notifications` | 96², white FLAT mark — Android discards gradients here |
| `splash.png` | `expo-splash-screen` + `animated-splash.tsx` | bare gradient mark, rendered at `imageWidth: 160` |
| `logo-mark.png` | legacy raster | prefer `<FKBrandMark>` (vector) |
| `mark.svg` | reference | canonical vector of the mark |

Icon and splash changes are **native** — they need `pnpm prebuild` and a new
build, not an OTA. Expo Go only ever shows the manifest icon.
