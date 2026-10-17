# Artist Links — completion tracker

Status: `[ ]` todo · `[~]` in progress · `[x]` done. Update this file as work lands.
Branch: `deploy-test`. Git rule: no stage/commit/push without an explicit ask (see `CLAUDE.md`).

## 1. Decisions (proposed — confirm or change)

| # | Question | Proposal | Status |
|---|----------|----------|--------|
| D-1 | Backend for caching + SSR SEO? | **Yes, thin.** The Nitro Node server already exists. Add TanStack Start server functions that proxy MusicBrainz with a real `User-Agent`, a server-side 1 req/s queue and an in-memory TTL cache (24h). Add an SSR route `/artist/$mbid` so each artist page is indexable with its own title/OG tags. No database for v1; add a persisted cache (SQLite + Docker volume) only if restarts hurt. | **agreed** |
| D-2 | Logo, favicon, OG image | I draft: SVG logo + favicon set + 1200×630 OG PNG (rendered from HTML/SVG). You review; polish in Figma/Canva only if wanted. | **agreed** |
| D-3 | Discoverable name search | **One smart input**: URL → link lookup; anything else → name search with debounced typeahead. Placeholder "Paste a link or type an artist name", plus tiny hint text. The "URL not found" fallback stays. | **agreed** |
| D-4 | Homepage content | **Featured artists**: a hand-picked list curated by us (static data file of MusicBrainz IDs + names, no user accounts, no saving). Plus **Recently viewed** in `localStorage` (per visitor, no backend). Featured also serves as the first-visit content, the example links, and the sitemap seed. Global "trending/recent searches" deferred: needs a store and shows other people's searches. | **agreed** |
| D-5 | URL flow | After a lookup resolves, navigate to `/artist/$mbid` (shareable, SSR'd). `/?url=` keeps working and redirects. | **agreed** |

### Added decisions (agreed)
- **D-6 Config via env, injected at runtime.** `.env.example` committed, `.env` gitignored. Vars: `MUSICBRAINZ_CONTACT`, `SITE_URL`, `SENTRY_DSN`, `PUBLIC_SENTRY_DSN`, `UMAMI_SCRIPT_URL`, `UMAMI_WEBSITE_ID`. Public values reach the browser through the root loader (one image, any environment). Empty = feature off.
- **D-7 Monitoring:** Sentry SDKs pointed at Bugsink, backend + frontend, no tracing/replay. **Analytics:** Umami script + events `lookup_url`, `lookup_name`, `artist_view`, `link_click`, `featured_click` (never the pasted URL).
- **D-8 Branding:** chosen by us; name stays "Artist Links". No domain yet: canonical/OG URLs use request origin unless `SITE_URL` set.
- **D-9 Git:** commit per wave on `deploy-test`, no push until asked. New dependencies allowed; each is reported to the user.
- **D-10 Deployment (G2) out of scope for now.**

## 2. Tasks

Effort: S ≲ 30 min · M ≈ 1–2 h · L ≈ half day. "Owns" = files the task may edit (used to avoid merge conflicts when fanning out).

### A. Quick fixes
- [ ] **A1** Fix heading typo "Artist Links3" — S — owns `src/routes/index.tsx` (h1 only)
- [ ] **A2** Lint error: empty `catch {}` at `src/lib/musicbrainz.ts:145` — S — owns `musicbrainz.ts`
- [ ] **A3** Fix social meta: drop `twitter:site: @Lovable`, add `og:image`/`og:url`/`og:site_name`, make `twitter:card` match; remove duplicate title/description — S — owns `src/routes/__root.tsx` — needs **C3** for the image path
- [ ] **A4** Decide on `lovable-error-reporting` (no-op outside Lovable editor): keep, or swap for real error tracking (Sentry/PostHog) — S — needs your call

### B. Tests
- [ ] **B1** Unit tests for `normalizeUrl`, `urlVariants`, `classify`, `artistLinks` (incl. unsupported track/album/playlist URLs, `intl-xx` Spotify paths, `www`/`m.` stripping) — S/M — owns `src/lib/*.test.ts`
- [ ] **B2** Component tests for Index states: idle, loading, error, unsupported, notfound, artist, featured, recent — M — owns `src/test/*` — needs **D-tasks**
- [ ] **B3** Server-side tests: cache hit/miss/TTL, queue spacing, UA header — M — owns tests next to **E1**

### C. Brand assets
- [ ] **C1** Logo (SVG, light/dark friendly) — S/M — owns `public/logo.svg`
- [ ] **C2** Favicon set: `favicon.svg`, `favicon.ico`, 32/16 png, `apple-touch-icon.png` (180), manifest icons; wire `<link>`s — S — owns `public/*`; the `<link>` edit goes through **A3**'s `__root.tsx` change
- [ ] **C3** OG image 1200×630 PNG (+ per-artist dynamic OG deferred) — S/M — owns `public/og.png`

### D. Homepage / UI
- [ ] **D0** *Prep refactor*: split `index.tsx` into `components/` (`SearchBox`, `ArtistView`, `NameResults`, `Notice`, `Skeleton`); no behavior change — M — owns `src/routes/index.tsx`, `src/components/*` — **must land first**; unblocks parallel D work
- [ ] **D1** Smart search input (URL vs name, debounced typeahead, hint text, keyboard nav, a11y) — M/L — owns `components/SearchBox.tsx`
- [ ] **D2** Featured artists: curated data file `src/data/featured.ts` (MBID, name, short blurb; ~8–12 artists) + `FeaturedArtists` section (cards link to `/artist/$mbid`) — S/M — owns `src/data/featured.ts`, `components/FeaturedArtists.tsx` — **needs the artist list from you**
- [ ] **D3** Recently viewed: hook + list (cap ~12, dedupe, clear button) — M — owns `hooks/use-recent.ts`, `components/RecentList.tsx`
- [ ] **D4** Hero: short "how it works", supported-platforms strip, layout so homepage doesn't look bare — S/M — owns `components/Hero.tsx`
- [ ] **D5** Assemble homepage (compose D1–D4 in `index.tsx`), responsive pass, first-visit state (Featured shown, Recent hidden when empty) — S/M — owns `src/routes/index.tsx` — last UI task

### E. Backend (caching + SSR SEO)
- [ ] **E1** Server layer: `src/server/musicbrainz.server.ts` + server functions (`lookupByUrl`, `getArtist`, `searchArtists`), `User-Agent` with contact URL, global 1 req/s queue, in-memory TTL/LRU cache, 503 retry — L — owns `src/server/*`
- [ ] **E2** SSR route `/artist/$mbid`: loader calls E1, `head()` sets title/description/canonical/OG per artist, 404 for bad MBID — M — owns `src/routes/artist.$mbid.tsx` — needs **E1**
- [ ] **E3** `sitemap.xml` + `robots.txt` sitemap line (home + featured artists from `featured.ts`; full sitemap deferred) — S — owns `public/*`/route
- [ ] **E4** Switch client from direct MusicBrainz `fetch` to server functions; URL flow per **D-5**; delete client queue — M — owns `src/lib/musicbrainz.ts` consumers — needs **E1**, **D0**
- [ ] **E5** *(optional)* Persist cache across restarts (SQLite + volume in Dokploy) — M — only if needed

### F. Product polish
- [ ] **F1** More platforms + icons (Beatport, Amazon Music, Twitch, Threads, Patreon, Bandcamp subdomains, Linktree, …); verify each icon exists in `@icons-pack/react-simple-icons` — M — owns `PLATFORMS` table + `platform-icons.ts`. Move `PLATFORMS`/`classify` to `src/lib/platforms.ts` to avoid colliding with E.
- [ ] **F2** *(optional)* Self-host fonts (DM Sans, Instrument Serif) instead of Google Fonts — S/M — owns `styles.css`, `public/fonts`

### G. Ops
- [ ] **G1** CI (GitHub Actions): `bun install --frozen-lockfile`, lint, test, build, `docker build`; fail if `bun.lock` contains `pkg.dev` — M — owns `.github/workflows/ci.yml`
- [ ] **G2** Create Dokploy app (Dockerfile build, port 3000), domain + HTTPS, smoke test with real Spotify/Bandcamp/Instagram URLs — M — **you** (I can drive via the Dokploy MCP if you want) — after wave 3
- [ ] **G3** Merge `deploy-test` → `main` (syncs to Lovable; no force-push) — S — **you**, when ready
- [ ] **G4** Dockerfile: confirm cache volume/env needs after E; keep healthcheck — S — owns `Dockerfile`
- [ ] **G5** *(skip unless asked)* Prune unused shadcn components/Radix deps — Lovable may re-add them

### H. Docs
- [ ] **H1** Update `README.md` + `CLAUDE.md` (server layer, cache, routes, env, new commands) — S — runs last

## 3. Parallelism plan

Conflict hot-spots: `src/routes/index.tsx`, `src/routes/__root.tsx`, `src/lib/musicbrainz.ts`. D0 and the E1 file split remove most of the overlap.

**Wave 0 — sequential, one agent (me), small**
A1, A2, D0, plus split `musicbrainz.ts` into pure helpers/types vs. fetch layer, and agree the server-function signatures (the contract between E and D).

**Wave 1 — fully parallel (disjoint files)**

| Agent | Tasks | Files |
|-------|-------|-------|
| 1 Brand | C1, C2, C3 | `public/*` |
| 2 Backend | E1 (+B3) | `src/server/*` |
| 3 Tests | B1 | `src/lib/*.test.ts` |
| 4 Platforms | F1 | `src/lib/platforms.ts`, `platform-icons.ts` |
| 5 CI | G1 | `.github/` |
| 6 Hooks/data | D3 (recent hook), D2 (featured data file) | `src/hooks/*`, `src/data/*` |

**Wave 2 — parallel after wave 0 + E1**

| Agent | Tasks | Files |
|-------|-------|-------|
| 1 | D1 smart search | `components/SearchBox.tsx` |
| 2 | D2 + D3 UI (featured cards, recent list) | `components/FeaturedArtists.tsx`, `RecentList.tsx` |
| 3 | D4 hero | `components/Hero.tsx` |
| 4 | E2 artist SSR route + E3 | `src/routes/artist.$mbid.tsx`, `public/` |

**Wave 3 — sequential integration (one agent)**
E4 (wire client to server), D5 (assemble homepage), A3 (meta + favicon links, uses C outputs), A4, B2, then H1.

**Wave 4 — you**
G3 merge, G2 deploy + smoke test.

Rules for fan-out: each agent works in its own git worktree, edits only its "owns" files, runs `bun run lint && bun run test` before reporting, and does not commit (commits happen in the integration step when you ask).

## 4. Open questions for you
1. **Featured artists list** (~8–12 names or MusicBrainz URLs) — needed for D2/E3. If you give names only, I'll resolve the MBIDs and you confirm.
2. Contact URL/email for the MusicBrainz `User-Agent` (their policy requires one) — E1.
3. Product name/branding direction for the logo (keep "Artist Links"? colors? the current theme in `styles.css` is the default palette).
4. Production domain (for canonical URLs, `og:url`, sitemap).
5. Error tracking: keep no-op, or Sentry/PostHog? (A4)
