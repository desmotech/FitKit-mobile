# taikan-mobile

Expo (managed workflow) React Native app for Taikan members — extracted
from the Taikan monorepo as a standalone repo. Mirrors the member
surfaces of `apps/web` with native value-adds: QR / GPS check-in, push
notifications, offline cache, haptics, and smooth gestures.

## Prerequisites

- Node 24 (`.nvmrc`-compatible)
- pnpm 10
- A GitHub Personal Access Token with `read:packages` scope, exported as
  `GITHUB_TOKEN` so pnpm can install `@taikan/shared` from GitHub
  Packages (see "Shared code" below).
- Xcode (iOS) and/or Android Studio (Android) for native builds.

## Shared code: `@taikan/shared`

This app depends on Zod schemas, types, validation, and i18n
dictionaries shipped from the source-of-truth Taikan monorepo as a
versioned npm package.

- **Source repo:** `desmotech/fitnx2` → `libs/shared/`
- **Published as:** `@desmotech/taikan-shared` on GitHub Packages
- **Aliased here as:** `@taikan/shared` (via the npm: protocol in
  `package.json`) so imports stay identical to the source repo

A GitHub Actions workflow in the source repo
(`.github/workflows/publish-shared.yml`) auto-publishes a patch release
on every push to `main` that touches `libs/shared/**`. Manual minor /
major bumps are available via the workflow's `workflow_dispatch` input.

### Auth setup (one-time)

GitHub Packages requires authentication even for read access to a
private package. Create a PAT with `read:packages`, then export it:

```bash
# in your shell profile (~/.zshrc, ~/.bashrc)
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The repo's `.npmrc` reads `${GITHUB_TOKEN}` at install time.

### Bumping the shared dependency

```bash
pnpm up @taikan/shared@latest
```

Or pin to a specific version published by the workflow:

```bash
pnpm up @taikan/shared@npm:@desmotech/taikan-shared@x.y.z
```

## Setup

```bash
# install
pnpm install

# expo will warn if any expo-managed package is on a wrong SDK 55
# version; run --fix to true it up:
pnpm exec expo install --fix

cp .env.example .env
# fill in EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY (the same publishable key used by web),
# EXPO_PUBLIC_API_URL, EXPO_PUBLIC_WEB_URL, etc.

# start the dev server
pnpm start
```

Open the Expo Go app on a physical device and scan the QR code, or
press `i` / `a` in the terminal for iOS / Android simulators.

## Commands

| Command                  | What it does                                  |
| ------------------------ | --------------------------------------------- |
| `pnpm start`             | `expo start` — Metro dev server               |
| `pnpm ios`               | `expo run:ios`                                |
| `pnpm android`           | `expo run:android`                            |
| `pnpm typecheck`         | `tsc --noEmit`                                |
| `pnpm lint`              | `eslint .`                                    |
| `pnpm prebuild`          | `expo prebuild --non-interactive`             |
| `pnpm build:preview`     | `eas build --profile preview` (internal dist) |
| `pnpm build:production`  | `eas build --profile production`              |

## Architecture notes

- **Auth**: `ClerkProvider` from `@clerk/clerk-expo` in
  `app/_layout.tsx`. Token cache via `expo-secure-store` — required so
  sessions survive cold starts.
- **API client**: `useApi` in `src/hooks/use-api.ts` (10s in-memory
  token cache, single 401 retry). Reads base URL from `expo-constants`
  `extra.apiUrl`.
- **Theme**: NativeWind 4 `dark:` variants follow the system color
  scheme. Tailwind tokens point to CSS variables (`var(--primary)`)
  defined in `global.css`.
- **Navigation**: Expo Router (SDK 55) with file-based routes under
  `app/`. `(auth)` and `(tabs)` are route groups; deep links land on
  `app/checkin.tsx`.
- **i18n**: `I18nProvider` reads device locale via `expo-localization`,
  falls back to Hebrew (matches web default). Dictionaries from
  `@taikan/shared`.
- **Realtime**: `socket.io-client` with `transports: ['websocket']`,
  AppState lifecycle awareness, JWT rotation.

## Fonts and icons

- Fonts: `assets/fonts/` — drop `.otf`/`.ttf` files and uncomment the
  `useFonts` lines in `app/_layout.tsx`.
- Icons: `assets/images/{icon,splash,adaptive-icon}.png` — required for
  builds.
