# Meww.me Top Chart

> JSON API for Spotify top charts data, scraped from [Kworb.net](https://kworb.net) and enriched with Spotify, Last.fm, MusicBrainz, and Wikipedia metadata.

## Overview

Meww.me Top Chart is a **JSON-only API service** built with Next.js that scrapes Spotify chart data from Kworb.net, enriches it with metadata from multiple sources, and serves it through clean REST endpoints.

### Key Features

- 📊 **Top Artists & Tracks**  Scraped from Kworb.net for 20 countries + global
- 🎵 **Spotify Integration**  Automatic Spotify URL matching, play counts, and metadata
- 🏷️ **Rich Metadata**  Genres, biographies, images, social links from Last.fm, MusicBrainz, and Wikipedia
- 📈 **Historical Data**  Daily snapshots with rank changes and listener deltas
- 🌍 **Multi-Country Support**  Global + 19 country-specific charts
- 🔄 **Auto-Refresh** Cron-based data refresh via Vercel or manual trigger
- 🧪 **Built-in API Tester**  Postman-style UI to explore and test endpoints

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Database | MySQL (production) / SQLite (development) |
| ORM | [Prisma](https://www.prisma.io/) |
| Scraping | [Cheerio](https://cheerio.js.org/) |
| API Sources | Spotify Web API, Last.fm API, MusicBrainz API, Wikipedia |
| Deployment | Vercel / Hostinger Node.js |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- MySQL database (or SQLite for local dev)
- [Spotify Developer](https://developer.spotify.com/dashboard) app credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/lrmn7/mewwme-top-chart.git
cd mewwme-top-chart

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### Environment Variables

Edit `.env` with your credentials:

```env
# Required
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
DATABASE_URL="mysql://user:password@host:3306/database"

# Admin secret for triggering data refresh
ADMIN_SECRET=your_secret_here

# Countries to scrape (comma-separated)
SCRAPE_COUNTRIES=global,id,us,gb,jp,kr,de,fr,br,mx,in,au,es,it,ca,se,ph,tr,ar,nl

# Limits
TOP_ARTISTS_LIMIT=25
TOP_TRACKS_LIMIT=25

# Optional: Rate limit rotation (add up to 3 Spotify client pairs)
# SPOTIFY_CLIENT_ID_2=second_client_id
# SPOTIFY_CLIENT_SECRET_2=second_client_secret

# Server port (for custom server)
PORT=3301
```

### Database Setup

```bash
# Push schema to database
npx prisma db push

# (Optional) Open Prisma Studio to browse data
npx prisma studio
```

### Running

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

---

## API Endpoints

### Stats

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stats/artists` | Top artists with rank, listeners, metadata |
| `GET` | `/api/stats/tracks` | Top tracks with daily/total streams |
| `GET` | `/api/stats/countries` | List of supported countries |
| `GET` | `/api/stats/last-updated` | Timestamp of last data refresh |
| `GET` | `/api/stats/artist/[artistId]` | Detailed artist info by Spotify ID |
| `GET` | `/api/stats/artist/[artistId]/history` | Artist rank/listener history |
| `GET` | `/api/stats/tracks/history` | Track stream history |

### Query Parameters

#### `/api/stats/artists`
| Param | Default | Description |
|-------|---------|-------------|
| `sortBy` | `rank` | Sort by `rank` or `dailyChange` |
| `country` | `global` | Country code (e.g., `id`, `us`, `gb`) |
| `limit` | `25` | Number of results |

#### `/api/stats/tracks`
| Param | Default | Description |
|-------|---------|-------------|
| `country` | `global` | Country code |
| `limit` | `25` | Number of results |

#### `/api/stats/artist/[artistId]/history`
| Param | Default | Description |
|-------|---------|-------------|
| `country` | `global` | Country code |
| `days` | `30` | Number of days of history |

#### `/api/stats/tracks/history`
| Param | Default | Description |
|-------|---------|-------------|
| `track` | — | Track name (required) |
| `artist` | — | Artist name (required) |
| `country` | `global` | Country code |
| `days` | `30` | Number of days of history |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/cron/refresh?secret=YOUR_SECRET` | Trigger data refresh |
| `POST` | `/api/cron/refresh` | Trigger data refresh (JSON body) |

### Example Response

```json
GET /api/stats/artists?country=global&limit=2

{
  "artists": [
    {
      "artistId": "1Xyo4u8uXC1ZmMpatF05PJ",
      "name": "The Weeknd",
      "rank": 1,
      "previousRank": 1,
      "rankDelta": 0,
      "monthlyListeners": 115000000,
      "listenersDelta": 250000,
      "imageUrl": "https://i.scdn.co/image/...",
      "genres": ["canadian pop", "pop"],
      "spotifyUrl": "https://open.spotify.com/artist/...",
      "followers": 45000000,
      "popularity": 96
    }
  ]
}
```

---

## Architecture

```
src/
├── app/
│   ├── page.tsx                  # API Explorer UI (Postman-style tester)
│   ├── layout.tsx                # Root layout
│   └── api/
│       ├── cron/refresh/         # Data refresh endpoint
│       ├── stats/
│       │   ├── artists/          # Top artists API
│       │   ├── tracks/           # Top tracks API
│       │   ├── countries/        # Supported countries
│       │   ├── last-updated/     # Last refresh timestamp
│       │   └── artist/[id]/      # Artist detail + history
│       └── ...
├── lib/
│   ├── db.ts                     # Prisma client singleton
│   ├── types.ts                  # TypeScript interfaces
│   ├── spotify.ts                # Spotify URL search utility
│   ├── spotify/
│   │   ├── auth.ts               # Multi-client Spotify auth with rotation
│   │   └── metadata.ts           # Spotify metadata enrichment
│   ├── services/
│   │   └── statsProvider.ts      # Core data aggregation service
│   └── scraping/
│       ├── kworbArtists.ts       # Global top artists scraper
│       ├── kworbTracks.ts        # Global top tracks scraper
│       ├── kworbCountry.ts       # Multi-country chart scraper
│       ├── kworbIndonesia.ts     # Indonesia-specific scraper
│       ├── kworbScraper.ts       # Base Kworb scraping utilities
│       ├── kworbArtistDetails.ts # Artist detail page scraper
│       ├── lastfmGenres.ts       # Genre tagging from Last.fm
│       ├── lastfmImages.ts       # Artist image fetching
│       ├── lastfmTracks.ts       # Top tracks/albums from Last.fm
│       ├── musicbrainz.ts        # MusicBrainz metadata (origin, links)
│       ├── wikipediaBio.ts       # Artist biographies from Wikipedia
│       ├── spotifyTrackData.ts   # Spotify track metadata
│       ├── spotifyPlayCountService.ts  # Play count estimation
│       └── spotifyWebScraper.ts  # Spotify web data scraping
├── prisma/
│   ├── schema.prisma             # MySQL schema (primary)
│   ├── schema.mysql.prisma       # MySQL variant
│   └── schema.postgresql.prisma  # PostgreSQL variant
└── server.js                     # Custom server (Hostinger compatible)
```

---

## Data Flow

```
Kworb.net  ──scrape──▶  Raw Chart Data
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         Spotify API     Last.fm API     Wikipedia
        (URLs, meta)    (genres, imgs)   (biography)
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                     statsProvider.ts
                     (merge & enrich)
                              │
                              ▼
                    Prisma / MySQL DB
                              │
                              ▼
                      JSON API Routes
```

1. **Scrape**  Kworb.net is scraped for top artists (by monthly listeners) and top tracks (by daily streams) across 20 countries
2. **Enrich**  Each artist/track is enriched with Spotify IDs, images, genres, biographies, social links, and play counts
3. **Store**  Data is persisted to MySQL with daily snapshots for historical tracking
4. **Serve**  Clean JSON APIs expose the data with filtering, sorting, and pagination

---

## Data Refresh

Data is refreshed via the `/api/cron/refresh` endpoint:

- **Vercel Cron**  Automatically runs at 00:00 and 12:00 UTC daily (configured in `vercel.json`)
- **Manual**  Call `GET /api/cron/refresh?secret=YOUR_ADMIN_SECRET`
- **Script**  Run `node refresh-data.js` directly

---

## Supported Countries

| Code | Country | Code | Country |
|------|---------|------|---------|
| `global` | 🌍 Global | `kr` | 🇰🇷 South Korea |
| `us` | 🇺🇸 United States | `in` | 🇮🇳 India |
| `gb` | 🇬🇧 United Kingdom | `au` | 🇦🇺 Australia |
| `id` | 🇮🇩 Indonesia | `es` | 🇪🇸 Spain |
| `jp` | 🇯🇵 Japan | `it` | 🇮🇹 Italy |
| `de` | 🇩🇪 Germany | `ca` | 🇨🇦 Canada |
| `fr` | 🇫🇷 France | `se` | 🇸🇪 Sweden |
| `br` | 🇧🇷 Brazil | `ph` | 🇵🇭 Philippines |
| `mx` | 🇲🇽 Mexico | `tr` | 🇹🇷 Turkey |
| `nl` | 🇳🇱 Netherlands | `ar` | 🇦🇷 Argentina |

---

## Deployment

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set environment variables in Vercel dashboard. Cron jobs are configured in `vercel.json`.

### Hostinger / Custom Node.js

```bash
npm run build
node server.js
```

The custom `server.js` includes `.htaccess` self-healing for Apache-based hosting (LiteSpeed/Hostinger).

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:studio` | Open Prisma Studio |
| `node refresh-data.js` | Manual data refresh |
| `node check-data.js` | Check data counts in database |

---

## License

This project is for personal/educational use.
