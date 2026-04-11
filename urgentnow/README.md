# UrgentNow

Real-time emergency room wait times, urgent care clinics, and pharmacies across Perth, WA.

## Tech stack

| Layer | Technology |
|---|---|
| Web frontend | Next.js 14, React, `@vis.gl/react-google-maps` |
| Backend API | Node.js, Express, TypeScript |
| Cache | Redis (local or Upstash free tier) |
| Push notifications | Firebase Cloud Messaging (FCM) |
| Maps | Google Maps JavaScript SDK |
| Place data | Google Places API (New) |
| Directions | Google Routes API |
| ED wait times | WA Health scraper (polls every 2 min) |
| Mobile (future) | React Native + Expo |

---

## Quick start

### 1. Prerequisites

```bash
node >= 20
npm >= 10
redis-server   # brew install redis  OR  use Upstash free tier
```

### 2. Clone and install

```bash
git clone https://github.com/yourorg/urgentnow
cd urgentnow
npm install
```

### 3. Google Cloud setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project: `urgentnow`
3. Enable these APIs:
   - **Maps JavaScript API** (web map rendering)
   - **Places API (New)** (facility search + hours + busyness)
   - **Routes API** (drive time)
   - **Geocoding API** (address search)
4. Create **two** API keys:
   - `WEB_KEY` — restrict to HTTP referrers (your domain) + Maps JS + Places APIs
   - `SERVER_KEY` — restrict to your server IP + Places + Routes APIs

### 4. Firebase setup (for push notifications)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create project `urgentnow`
3. Go to Project Settings → Service Accounts → Generate New Private Key
4. Download the JSON file
5. Stringify it: `node -e "console.log(JSON.stringify(require('./serviceAccount.json')))"`
6. Paste into `FIREBASE_SERVICE_ACCOUNT` in your `.env`

### 5. Environment variables

```bash
cp .env.example .env
# Edit .env and fill in your API keys
```

Create a `backend/.env` file too (same values for the backend keys).

### 6. Run

```bash
# In one terminal — starts Redis, backend, and web app
npm run dev
```

Web app: http://localhost:3000
Backend: http://localhost:3001
Health check: http://localhost:3001/api/health

---

## Project structure

```
urgentnow/
├── apps/
│   ├── web/                     # Next.js web app
│   │   └── src/
│   │       ├── app/             # Next.js App Router layout
│   │       ├── components/      # React components
│   │       │   ├── MapView.tsx  # Google Map + markers
│   │       │   ├── Sidebar.tsx  # Results list
│   │       │   ├── FacilityCard.tsx
│   │       │   ├── DetailPanel.tsx  # Wait time, alerts, directions
│   │       │   ├── FilterBar.tsx    # Type chips + radius slider
│   │       │   └── TriageModal.tsx  # Symptom checker
│   │       ├── hooks/
│   │       │   ├── useUserLocation.ts
│   │       │   ├── useFacilities.ts
│   │       │   └── useAlerts.ts
│   │       └── styles/globals.css
│   └── mobile/                  # React Native (Expo) — future
├── backend/
│   └── src/
│       ├── index.ts             # Express server
│       ├── routes/
│       │   ├── facilities.ts    # GET /api/facilities
│       │   ├── edWait.ts        # GET /api/ed-wait-times
│       │   ├── driveTime.ts     # POST /api/drive-time
│       │   └── alerts.ts        # CRUD /api/alerts
│       ├── services/
│       │   ├── placesService.ts  # Google Places API (New)
│       │   ├── edScraper.ts      # WA Health ED scraper
│       │   └── cache.ts          # Redis helpers
│       └── jobs/
│           ├── edCacheJob.ts     # Polls WA Health every 2 min
│           └── alertJob.ts       # Checks thresholds + fires FCM
└── packages/
    ├── types/src/index.ts        # Shared TypeScript types
    └── api-client/src/index.ts   # Shared fetch + sort/filter logic
```

---

## API reference

### `GET /api/facilities`
Returns merged Places + ED wait data.

| Param | Type | Default | Description |
|---|---|---|---|
| `lat` | number | required | Latitude |
| `lng` | number | required | Longitude |
| `radius` | number | 10000 | Search radius in metres |
| `hospitals` | boolean | true | Include hospitals |
| `urgentCare` | boolean | true | Include urgent care |
| `pharmacies` | boolean | true | Include pharmacies |

### `GET /api/ed-wait-times`
Returns latest scraped ED wait times from WA Health.

### `POST /api/drive-time`
Body: `{ origin: {lat, lng}, destination: {lat, lng} }`  
Returns: `{ minutes: number, distanceMetres: number }`

### `POST /api/alerts`
Body: `{ userId, hospitalId, hospitalName, thresholdMinutes }`  
Creates a push notification subscription.

---

## Deployment

### Backend — Railway or Fly.io
```bash
# Railway (easiest)
npm install -g @railway/cli
railway init
railway add redis    # adds a Redis instance
railway up
```

### Web — Vercel
```bash
npm install -g vercel
cd apps/web
vercel --prod
```

Set environment variables in the Vercel dashboard to match `.env.example`.

---

## Notes on WA Health data

The WA Health ED Activity page (`health.wa.gov.au`) doesn't publish a formal API. The `edScraper.ts` service:
1. First tries to parse the embedded `__NEXT_DATA__` JSON blob (most reliable)
2. Falls back to HTML table scraping if the JSON structure changes

The scraper runs every 2 minutes, matching the page's update frequency. Results are cached in Redis with a 2-minute TTL. If the scrape fails, the last cached result is served.

---

## Disclaimer

This application provides information to help users make decisions about seeking medical care. It is not a substitute for professional medical advice. In life-threatening emergencies, always call **000**.
