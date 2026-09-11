import cors from '@fastify/cors';
import Fastify from 'fastify';
import { earthEventTypeSchema, severitySchema } from '@earth-pulse/shared';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { z } from 'zod';
import { config } from './config.js';
import { createDatabase } from './db/database.js';
import { EventRepository } from './repositories/eventRepository.js';
import { ObservationRepository } from './repositories/observationRepository.js';
import { ProviderStateRepository } from './repositories/providerStateRepository.js';
import { SpaceWeatherRepository } from './repositories/spaceWeatherRepository.js';
import { AirQualityService } from './services/airQualityService.js';
import { NearbyService } from './services/nearbyService.js';
import { PersistedEarthEventService } from './services/persistedEarthEventService.js';
import { SpaceWeatherService } from './services/spaceWeatherService.js';
import { GeocodeService } from './services/geocodeService.js';

const eventQuerySchema = z.object({ type: z.union([z.string(), z.array(z.string())]).optional(), severity: severitySchema.optional(), provider: z.string().trim().min(1).max(80).optional(), source: z.string().trim().min(1).max(80).optional(), minMagnitude: z.coerce.number().min(0).max(10).optional(), from: z.iso.datetime().optional(), to: z.iso.datetime().optional(), bbox: z.string().optional(), cursor: z.iso.datetime().optional(), limit: z.coerce.number().int().min(1).max(2_000).optional(), view: z.enum(['map']).optional(), refresh: z.enum(['true', 'false']).optional() });
const observationQuerySchema = z.object({ bbox: z.string().optional(), zoom: z.coerce.number().min(0).max(20).optional(), limit: z.coerce.number().int().min(1).max(20_000).optional() });
const locationQuerySchema = z.object({ lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180), radiusKm: z.coerce.number().min(40).max(805).optional() });
const geocodeQuerySchema = z.object({ q: z.string().trim().min(2).max(120) });
const contentTypes: Record<string, string> = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.map': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

function parseBbox(value: string | undefined): [number, number, number, number] | undefined | null { if (!value) return undefined; const values = value.split(',').map(Number); if (values.length !== 4 || values.some((item) => !Number.isFinite(item))) return null; const [west, south, east, north] = values as [number, number, number, number]; return west < -180 || west > 180 || east < -180 || east > 180 || south < -90 || south > 90 || north < -90 || north > 90 || south > north ? null : [west, south, east, north]; }
function parseTypes(value: string | string[] | undefined) { if (!value) return undefined; const values = (Array.isArray(value) ? value : [value]).flatMap((item) => item.split(',')).filter(Boolean); const parsed = z.array(earthEventTypeSchema).safeParse(values); return parsed.success ? parsed.data : null; }

export function buildPersistedApp() {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is required for the persisted API.');
  const db = createDatabase(config.databaseUrl, config.databaseSsl); const events = new EventRepository(db); const observations = new ObservationRepository(db); const states = new ProviderStateRepository(db); const persistedEvents = new PersistedEarthEventService(events, observations, states); const airQuality = new AirQualityService(config.openMeteoAirQualityUrl, config.airQualityCacheTtlMs); const nearby = new NearbyService(events, observations, states, airQuality); const spaceWeather = new SpaceWeatherService(new SpaceWeatherRepository(db)); const geocode = new GeocodeService(config.nominatimBaseUrl, config.userAgent);
  const app = Fastify({ logger: false }); void app.register(cors, { origin: config.webOrigin }); app.addHook('onClose', async () => { await db.destroy(); });
  app.get('/api/events', async (request, reply) => { const query = eventQuerySchema.safeParse(request.query); const types = query.success ? parseTypes(query.data.type) : null; const bounds = query.success ? parseBbox(query.data.bbox) : null; if (!query.success || types === null || bounds === null) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Invalid event query.' } }); return persistedEvents.getEvents({ ...(types ? { types } : {}), ...(query.data.severity ? { severity: query.data.severity } : {}), ...(query.data.provider ? { provider: query.data.provider } : {}), ...(query.data.source ? { source: query.data.source } : {}), ...(query.data.minMagnitude != null ? { minMagnitude: query.data.minMagnitude } : {}), ...(query.data.from ? { from: query.data.from } : {}), ...(query.data.to ? { to: query.data.to } : {}), ...(bounds ? { bbox: bounds } : {}), ...(query.data.cursor ? { cursor: query.data.cursor } : {}), ...(query.data.limit ? { limit: query.data.limit } : {}), ...(query.data.view === 'map' ? { mapView: true } : {}) }); });
  app.get('/api/events/:id', async (request, reply) => { const id = (request.params as { id?: string }).id; if (!id) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Event id is required.' } }); const detail = await persistedEvents.getEventDetail(id); return detail ?? reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Event not found.' } }); });
  app.get('/api/observations', async (request, reply) => { const query = observationQuerySchema.safeParse(request.query); const bounds = query.success ? parseBbox(query.data.bbox) : null; if (!query.success || bounds === null) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Invalid observation query.' } }); return observations.query({ ...(bounds ? { bbox: bounds } : {}), ...(query.data.zoom != null ? { zoom: query.data.zoom } : {}), ...(query.data.limit != null ? { limit: query.data.limit } : {}) }, await states.get('firms')); });
  app.get('/api/nearby', async (request, reply) => { const query = locationQuerySchema.safeParse(request.query); if (!query.success) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Invalid nearby-location query.' } }); return nearby.get(query.data.lat, query.data.lon, query.data.radiusKm ?? 160.934); });
  app.get('/api/environment', async (request, reply) => { const query = locationQuerySchema.safeParse(request.query); if (!query.success) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Invalid location query.' } }); return airQuality.current(query.data.lat, query.data.lon); });
  app.get('/api/space-weather', async () => spaceWeather.summary()); app.get('/api/pulse/global', async () => persistedEvents.globalPulse()); app.get('/api/pulse/local', async (request, reply) => { const query = locationQuerySchema.safeParse(request.query); if (!query.success) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Invalid location query.' } }); return (await nearby.get(query.data.lat, query.data.lon, query.data.radiusKm ?? 160.934)).pulse; });
  app.get('/api/status', async (_request, reply) => { try { return await persistedEvents.getStatus(); } catch { return reply.code(503).send({ status: 'unavailable', database: { ready: false } }); } });
  app.get('/api/geocode', async (request, reply) => { const query = geocodeQuerySchema.safeParse(request.query); if (!query.success) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Enter 2–120 characters.' } }); try { return { results: await geocode.search(query.data.q) }; } catch { return reply.code(503).send({ error: { code: 'GEOCODER_UNAVAILABLE', message: 'Location search is temporarily unavailable.', retryable: true } }); } });
  app.setNotFoundHandler(async (request, reply) => { const webRoot = process.env.WEB_DIST_DIR ?? join(process.cwd(), 'apps/web/dist'); if (request.method === 'GET' && !request.url.startsWith('/api') && existsSync(webRoot)) { const requestedPath = request.url.split('?')[0] ?? '/'; const candidate = join(webRoot, requestedPath === '/' ? 'index.html' : requestedPath.slice(1)); const filePath = existsSync(candidate) ? candidate : join(webRoot, 'index.html'); return reply.type(contentTypes[extname(filePath)] ?? 'application/octet-stream').send(await readFile(filePath)); } return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }); });
  return app;
}
