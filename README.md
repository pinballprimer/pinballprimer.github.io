# Pinball Primer (mobile)

A mobile-friendly reader for [The Pinball Primer](https://pinballprimer.github.io/). All game content is from the original site — this is an unofficial reader that adds search, filters, and reflow-able typography. The original site is the authority.

## How it works

This repo is a fork of [pinballprimer/pinballprimer.github.io](https://github.com/pinballprimer/pinballprimer.github.io). The original `*.html` files at the repo root are untouched. The mobile reader lives in `/mobile/` and parses the upstream HTML in the browser at runtime — no build step, no scraping, no separate data file.

```
.
├── *.html                      # upstream content (synced from pinballprimer)
├── *.jpg                       # upstream images
├── mobile/                     # the mobile reader (this repo's additions)
│   ├── index.html              # search and filters
│   ├── game.html               # reader view
│   ├── styles.css              # mobile-first typography
│   ├── parser.js               # DOMParser helpers for gamelist + game pages
│   ├── app.js                  # index page logic
│   └── game.js                 # game page logic
└── .github/workflows/
    └── sync-upstream.yml       # weekly fork sync from pinballprimer
```

## Run locally

The reader uses relative URLs (`../gamelist.html`, `../{game_id}.html`) so it needs an HTTP server serving from the repo root.

```bash
cd ~/Documents/ai/pinballprimer-mobile
python3 -m http.server 8080
# open http://localhost:8080/mobile/
```

Any static server works. Don't open `mobile/index.html` directly via `file://` — `fetch()` won't read local files.

## Deploy

GitHub Pages, deployed from the repo root on `main`:

1. **Settings → Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main` / `/(root)`
4. Save

URL: `https://branables.github.io/pinballprimer-mobile/mobile/`

The original site is also served at the repo root: `https://branables.github.io/pinballprimer-mobile/` — kept intact so the mobile reader can fetch from it.

## Stay in sync with upstream

Two ways:

**Automatic** — `.github/workflows/sync-upstream.yml` runs every Monday at 14:00 UTC and pulls upstream changes into `main`. You can also run it manually: **Actions → Sync from upstream pinballprimer → Run workflow**.

**Manual** — on GitHub: your fork → "Sync fork" button → "Update branch". Or from the CLI:

```bash
gh repo sync branables/pinballprimer-mobile
```

To see what's changed upstream before syncing:

```bash
gh repo sync branables/pinballprimer-mobile --dry-run
```

Or visit https://github.com/branables/pinballprimer-mobile/compare/main...pinballprimer:pinballprimer.github.io:main

## Architecture notes

- **No build step.** `parser.js` does HTML → structured data in the browser. If you ever want full-text search across all game contents, you'd add a build step that pre-indexes; for now title/manufacturer/year/type are filterable from the gamelist page alone.
- **Caching.** The parsed gamelist is cached in `sessionStorage` for 24h to avoid re-fetching on every page load.
- **Navigation.** When you click a game from a filtered list, the filter state is preserved in the URL (`game.html?id=X&from=q%3Dking%26decade%3D1970s`). "Back" returns to that exact filter state. Prev/Next walks the filtered list (or falls back to alphabetical if you opened a game directly via a shared URL).

## Future ideas

- Tournament lists (multi-select games into a personal list stored in `localStorage`)
- Full-text search across game contents (would require a small build step)
- Offline support via service worker

## Attribution

All game content is from [The Pinball Primer](https://pinballprimer.github.io/) by its author. This project is a mobile reader on top of the public content of that site. Visit the original for the canonical version.
