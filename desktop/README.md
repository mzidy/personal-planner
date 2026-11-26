# Serene for macOS

The whole planner as a Mac app. Electron starts the same Nuxt server the website
runs and shows it in a window; the data lives in a SQLite file on the Mac, not
in the website's Turso database.

## Build

```bash
npm install --prefix desktop   # once: Electron and electron-builder
npm run desktop:build          # → desktop/dist/Serene-<version>-arm64.dmg and mac-arm64/Serene.app
```

`desktop:build` builds the server for plain Node with `SERENE_DESKTOP=1`, which
also ships the local SQLite client and its native binary (Apple Silicon), then
packages it. `npm run desktop:start` runs it from the repo without packaging.
`npm run icon --prefix desktop` redraws `build/icon.icns`.

The app is signed ad hoc only. It runs on the Mac that built it; on another
Mac, open it once with right-click → Open (Gatekeeper), or sign and notarise
it with a Developer ID.

## On the Mac

- Data: `~/Library/Application Support/Serene/planner.db`, plus `config.json`
  (the session secret, made on first launch, and the port) and `logs/server.log`.
  Help → Show Data Folder opens it.
- The server listens on `127.0.0.1:47821` only, so other devices on the network
  cannot reach it. The fixed port keeps you signed in between launches.
- The first launch seeds the demo workspace. "Need to initialize the
  workspace?" on the sign-in page turns it into your own account; the app is
  single-user.
- Optional settings go in `~/Library/Application Support/Serene/serene.env`,
  one `KEY=value` per line, e.g. `NUXT_ANTHROPIC_API_KEY=…` for the AI
  features. Restart the app after editing it.

## What needs the internet

Market data and quotes (Yahoo), the vacuum (Xiaomi / Roborock clouds), the AI
features (Anthropic) and the local speech model's first download. Everything
else works offline. Alexa cannot reach a Mac-only server; it keeps working
through the website. Google sign-in is not set up for the app.
