# Fonts

The FitKit design uses four families:

| Family         | License            | Source                                                                           |
| -------------- | ------------------ | -------------------------------------------------------------------------------- |
| Clash Grotesk  | Free (commercial)  | https://www.fontshare.com/fonts/clash-grotesk                                    |
| Manrope        | OFL                | https://fonts.google.com/specimen/Manrope                                        |
| Heebo          | OFL                | https://fonts.google.com/specimen/Heebo                                          |
| DM Mono        | OFL                | https://fonts.google.com/specimen/DM+Mono                                        |

Drop the `.ttf` (or variable `.ttf`) files into this directory with these
exact filenames so `app/_layout.tsx` finds them:

```
ClashGrotesk-Variable.ttf
Manrope-Variable.ttf
Heebo-Variable.ttf
DMMono-Regular.ttf
```

Then uncomment the matching `require(...)` lines in
`app/_layout.tsx`'s `useFonts()` call.

Bundling fonts (vs. Google Fonts CDN) avoids a flash of system text on
cold start and keeps the app usable offline.
