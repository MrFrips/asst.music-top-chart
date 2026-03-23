# Frontend Removal Summary

## What Was Removed

### Pages (4 files)
- `src/app/page.tsx` — Homepage dashboard (replaced with JSON API index)
- `src/app/blog/page.tsx` — Blog/daily briefing UI
- `src/app/me/page.tsx` — Last.fm stats dashboard
- `src/app/me/loading.tsx` — Loading skeleton for /me

### Components (23 files — entire `src/components/` directory)
- `ArtistAboutSection.tsx`, `ArtistHistoryChart.tsx`, `ArtistModal.tsx`, `ArtistTable.tsx`, `ArtistTableSideBySide.tsx`
- `GenerateBlogButton.tsx`, `GenreTags.tsx`, `ImageCarousel.tsx`, `PasswordGate.tsx`, `RefreshButton.tsx`
- `SimilarArtists.tsx`, `TopAlbums.tsx`, `TopTracks.tsx`, `TrackHistoryChart.tsx`, `TrackModal.tsx`, `TrackTable.tsx`
- `blog/BentoGrid.tsx`
- `lastfm/PeriodSelector.tsx`, `lastfm/RecentTracks.tsx`, `lastfm/Recommendations.tsx`, `lastfm/TopAlbums.tsx`, `lastfm/TopArtists.tsx`, `lastfm/TopTracks.tsx`

### Blog Backend (3 files/dirs)
- `src/app/api/cron/generate-blog/route.ts` — Blog generation cron endpoint
- `src/app/api/test-blog/route.ts` — Blog test endpoint
- `src/lib/llm/blogGenerator.ts` — Gemini-powered blog content generator
- `src/lib/analysis/dailyAnalyzer.ts` — Daily highlight analyzer for blog

### Last.fm Stats Backend (4 files/dirs)
- `src/app/api/lastfm/auth/route.ts` — Last.fm OAuth auth
- `src/app/api/lastfm/callback/route.ts` — Last.fm OAuth callback
- `src/app/api/test-lastfm/route.ts` — Last.fm test endpoint
- `src/app/api/test-lastfm-tracks/route.ts` — Last.fm tracks test endpoint
- `src/lib/lastfm/userServices.ts` — Last.fm user data fetching

### Styling & Config (4 files)
- `src/app/globals.css` — Tailwind CSS + custom styles
- `tailwind.config.js` — Tailwind configuration
- `postcss.config.js` — PostCSS configuration
- `src/app/actions.ts` — Server action for admin password gate (UI-only)

### Assets (1 file)
- `public/mewwme.gif` — Logo image

### Dependencies Removed (7 packages)
- `@google/generative-ai` — Gemini AI (blog generation)
- `lucide-react` — Icon library
- `recharts` — Chart library
- `react-is` — React utility
- `autoprefixer` — PostCSS plugin for Tailwind
- `postcss` — CSS processor
- `tailwindcss` — CSS framework

### Environment Variables Removed
- `GEMINI_API_KEY` — Gemini AI for blog generation
- `LASTFM_API_KEY` — Last.fm user stats
- `LASTFM_SHARED_SECRET` — Last.fm OAuth
- `LASTFM_USERNAME` — Last.fm user stats
- `LASTFM_SESSION_KEY` — Last.fm session

---

## What Was Preserved

### API Routes — No changes
- `/api/stats/artists`, `/api/stats/tracks`, `/api/stats/countries`, `/api/stats/last-updated`
- `/api/stats/artist/[artistId]`, `/api/stats/artist/[artistId]/history`
- `/api/stats/tracks/history`
- `/api/cron/refresh`
- `/api/debug-ranks`, `/api/test-db`, `/api/test-spotify-urls`, `/api/refresh-spotify-urls`

### Backend Libraries — No changes
- `lib/db.ts`, `lib/types.ts`, `lib/spotify.ts`
- `lib/spotify/auth.ts`, `lib/spotify/metadata.ts`
- `lib/services/statsProvider.ts`
- All 10 scraping modules in `lib/scraping/` (including `lastfmGenres.ts`, `lastfmImages.ts`, `lastfmTracks.ts` which are scraping utilities, not user stats)

### Database — No changes
- `prisma/schema.prisma`, `prisma/schema.mysql.prisma`, `prisma/schema.postgresql.prisma`

### Root Scripts — No changes
- `server.js`, `refresh-data.js`, `refresh-artist-tracks.js`, `refresh-artist-tracks.mjs`, `check-data.js`

---

## Routes Changed to JSON-Only

| Route | Before | After |
|-------|--------|-------|
| `/` (root) | Full HTML dashboard | JSON API endpoint index |
| `/blog` | HTML blog page | Route deleted (404) |
| `/me` | HTML Last.fm stats dashboard | Route deleted (404) |

---

## Files Modified (not deleted)

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Removed Google Font import, CSS import, body className |
| `src/app/page.tsx` | Replaced dashboard UI with JSON API endpoint index |
| `next.config.js` | Removed `images.remotePatterns` and blog/lastfm env vars |
| `package.json` | Removed 7 UI/blog/lastfm dependencies |
| `.env.example` | Removed 5 unused env vars (Gemini, Last.fm) |

---

## Remaining Notes

- **No files were skipped** — all identified UI and blog/lastfm files were safely deleted.
- **No manual cleanup needed** — all dead imports and references were verified clean.
- **Last.fm scraping modules preserved** — `lib/scraping/lastfmGenres.ts`, `lastfmImages.ts`, `lastfmTracks.ts` are used by `statsProvider.ts` for enriching artist data (not user stats).
- **Prisma BlogPost model kept** — The `BlogPost` model still exists in all 3 Prisma schema files (`schema.prisma`, `schema.mysql.prisma`, `schema.postgresql.prisma`). It was not removed to avoid breaking database migrations. If you want to fully remove it, delete the `BlogPost` model block from each schema and run `prisma db push`.
- Run `npm install` after this change to sync `node_modules` with the updated `package.json`.
