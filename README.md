# Earth Pulse

Earth Pulse is a location-aware, map-first dashboard for significant natural activity. Phase 3 persists provider data in PostgreSQL/PostGIS, performs geographic queries in the database, and adds Near Me, air-quality, space-weather, and deterministic related-activity signals.

## Workspace

```text
apps/
  api/       Fastify provider, adapter, cache, and API routes
  web/       React, Vite, Tailwind, and MapLibre dashboard
packages/
  shared/    EarthEvent schemas, types, severity, filters, and statistics
```

The web application knows only normalized `EarthEvent` and `EarthObservation` contracts. Provider-specific validation and transformation stay in the API. Add a provider with a provider fetcher, an adapter, and a registration in the event or observation service—never leak raw payloads into UI components.

## Run locally

Requirements: Node.js 22.13 or newer and pnpm 11.

```bash
pnpm install
Copy-Item .env.example .env
docker compose up -d postgres
pnpm --filter @earth-pulse/api db:migrate
pnpm dev
```

The dashboard opens at `http://localhost:5173`; Fastify listens on `http://localhost:3001`. Vite proxies `/api` to Fastify during development.

For local wildfire validation, set `FIRMS_MAP_KEY` in `.env` and set `IN_PROCESS_INGESTION=true`, then restart `pnpm dev`. Run `pnpm --filter @earth-pulse/api ingest` to populate the database once, or `pnpm --filter @earth-pulse/api dev:ingest` for local scheduled ingestion. Production uses the same in-process ingestion loop.

After ingestion, verify the live data contract locally before relying on the map:

```powershell
Invoke-RestMethod http://localhost:3001/api/status
Invoke-RestMethod 'http://localhost:3001/api/observations?type=wildfire-detection&zoom=1'
```

The first endpoint must report FIRMS as configured and healthy. The second must report a nonzero `totalDetections` when NASA FIRMS has current detections. In the browser, the **Wildfires** filter must show that detection count and orange map markers; tapping a marker opens its detail view.

Quality commands:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Copy `.env.example` to `.env` when configuration needs to change. `FIRMS_MAP_KEY` is required for wildfire detections and can be requested from NASA FIRMS; without it, only that provider is shown as unconfigured. Set `PROVIDER_USER_AGENT` to an identifying application/contact string for NWS. Provider TTLs are configurable; USGS/NWS default to two minutes and EONET/FIRMS to 15 minutes.

For a production build, run `pnpm build`, serve `apps/web/dist` from a static host, and run `node apps/api/dist/server.js` behind the same origin or an `/api` reverse proxy.

## API

- `GET /api/events?bbox=west,south,east,north&type=earthquake,volcano&severity=high&from=...&to=...` returns persisted events, global activity summary, and provider freshness.
- `GET /api/events/:id` returns one normalized event.
- `GET /api/observations?type=wildfire-detection&bbox=west,south,east,north&zoom=4` returns FIRMS grid aggregates at low zoom and viewport detections at high zoom.
- `GET /api/status` returns health for USGS, EONET, FIRMS, and NWS without internal errors or secrets.
- `GET /api/geocode?q=Boston` returns up to five normalized location results.
- `GET /api/nearby?lat=35.1&lon=-85.2&radiusKm=160.934` returns a purpose-built local activity summary without storing the location.
- `GET /api/environment`, `GET /api/space-weather`, `GET /api/pulse/global`, and `GET /api/pulse/local` expose Phase 3 condition and scoring data.

Provider ingestion records freshness and health in the database. A provider outage leaves the most recently ingested data available with explicit stale state; it does not make the dashboard unavailable. FIRMS observations are not feed events: they are stored separately and returned as map-friendly aggregates or viewport-limited records.

## External services and attribution

- Earthquake data comes from the [USGS GeoJSON feeds](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php), natural-event metadata from [NASA EONET](https://eonet.gsfc.nasa.gov/), wildfire detections from [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/), US alerts from [NOAA/NWS](https://www.weather.gov/documentation/services-web-api), space-weather data from NOAA SWPC, and modeled air-quality data from Open-Meteo/CAMS.
- The default basemap is the token-free [OpenFreeMap dark style](https://openfreemap.org/quick_start/) rendered by MapLibre. Map attribution remains visible.
- Location search uses the public [Nominatim service](https://operations.osmfoundation.org/policies/nominatim/) through the backend. It has no SLA and is appropriate only for moderate Phase 1 traffic. Earth Pulse performs search only on explicit form submission, identifies the application, serializes upstream calls to at most one request per second, caches repeated queries for 24 hours, and exposes a configurable base URL. Autocomplete and bulk geocoding are intentionally not implemented. A production service at scale should use a commercial or self-hosted geocoder.
- Device location is requested only after the user selects **Use My Location**. It is held in browser state for the active query, rounded before the air-quality request, and is never persisted or included in application logs.

## Earth Pulse severity and score

Severity is a visualization aid, not an official scientific hazard assessment. The 0–100 Pulse Score combines recency-weighted earthquakes, weather alerts, EONET events, and capped FIRMS activity. Its bands are Quiet (0–20), Normal (21–40), Active (41–60), Elevated (61–80), and Intense (81–100). It is a product-derived activity indicator, not a scientific risk index.
