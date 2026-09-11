import cors from '@fastify/cors';
import Fastify from 'fastify';
import { earthEventTypeSchema, severitySchema } from '@earth-pulse/shared';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { z } from 'zod';
import { config } from './config.js';
import { EonetProvider } from './providers/eonet.js';
import { FirmsProvider } from './providers/firms.js';
import { NwsProvider } from './providers/nws.js';
import { ProviderError } from './providers/providerError.js';
import { UsgsProvider } from './providers/usgs.js';
import { EarthEventService } from './services/earthEventService.js';
import { GeocodeService } from './services/geocodeService.js';
import { ObservationService } from './services/observationService.js';

const eventsQuerySchema = z.object({ type: z.union([z.string(), z.array(z.string())]).optional(), severity: severitySchema.optional(), source: z.string().trim().min(1).max(80).optional(), minMagnitude: z.coerce.number().min(0).max(10).optional(), refresh: z.enum(['true', 'false']).transform((value) => value === 'true').optional() });
const observationsQuerySchema = z.object({ type: z.literal('wildfire-detection').optional(), bbox: z.string().optional(), zoom: z.coerce.number().min(0).max(20).optional(), refresh: z.enum(['true', 'false']).transform((value) => value === 'true').optional() });
const geocodeQuerySchema = z.object({ q: z.string().trim().min(2).max(120) });
const unavailableObservation = { async getObservations() { throw new ProviderError('unconfigured', 'FIRMS is not configured.'); }, async count() { return 0; }, status() { return { configured: false, healthy: false, state: 'unconfigured' as const, lastSuccess: null, cacheAgeSeconds: null }; } };
const contentTypes: Record<string, string> = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.map': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

export interface AppServices { events: EarthEventService; observations?: Pick<ObservationService, 'getObservations' | 'count' | 'status'>; geocode: Pick<GeocodeService, 'search'>; }
function eventTypes(value: string | string[] | undefined) { if (!value) return undefined; const values = (Array.isArray(value) ? value : [value]).flatMap((item) => item.split(',')).filter(Boolean); const parsed = z.array(earthEventTypeSchema).safeParse(values); return parsed.success ? parsed.data : null; }
function bbox(value: string | undefined): [number, number, number, number] | undefined | null { if (!value) return undefined; const parts = value.split(',').map(Number); if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null; const west = parts[0]!; const south = parts[1]!; const east = parts[2]!; const north = parts[3]!; return west < -180 || west > 180 || east < -180 || east > 180 || south < -90 || south > 90 || north < -90 || north > 90 || south > north ? null : [west, south, east, north]; }

export function buildApp(services?: AppServices) {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  const resolved = services ?? (() => { const firms = new ObservationService(new FirmsProvider(config.firmsBaseUrl, config.firmsMapKey, config.firmsSource, config.firmsDayRange), config.firmsSource, config.firmsCacheTtlMs, config.refreshCooldownMs, config.maxStaleMs); return { events: new EarthEventService(new UsgsProvider(config.usgsFeedUrl, config.providerUserAgent), config.cacheTtlMs, config.refreshCooldownMs, config.maxStaleMs, new EonetProvider(config.eonetUrl, config.providerUserAgent), new NwsProvider(config.nwsAlertsUrl, config.providerUserAgent), config.eonetCacheTtlMs), observations: firms, geocode: new GeocodeService(config.nominatimBaseUrl, config.userAgent) }; })();
  const observations = resolved.observations ?? unavailableObservation;
  void app.register(cors, { origin: config.webOrigin });
  app.get('/api/events', async (request, reply) => { const query = eventsQuerySchema.safeParse(request.query); const types = query.success ? eventTypes(query.data.type) : null; if (!query.success || types === null) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Invalid event query.' } }); try { const count = await observations.count(query.data.refresh ?? false); return await resolved.events.getEvents(query.data.refresh ?? false, { types, severity: query.data.severity, source: query.data.source, minMagnitude: query.data.minMagnitude }, count); } catch (error) { return reply.code(503).send({ error: { code: error instanceof ProviderError && error.kind === 'malformed' ? 'PROVIDER_DATA_INVALID' : 'UPSTREAM_UNAVAILABLE', message: 'Live event data is temporarily unavailable.', retryable: true } }); } });
  app.get('/api/events/:id', async (request, reply) => { const id = (request.params as { id?: string }).id; if (!id) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Event id is required.' } }); try { const event = await resolved.events.getEvent(id); return event ? { event, relations: [] } : reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Event not found.' } }); } catch { return reply.code(503).send({ error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Live event data is temporarily unavailable.', retryable: true } }); } });
  app.get('/api/observations', async (request, reply) => { const query = observationsQuerySchema.safeParse(request.query); const bounds = query.success ? bbox(query.data.bbox) : null; if (!query.success || bounds === null) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Invalid observation query.' } }); try { return await observations.getObservations({ bbox: bounds, zoom: query.data.zoom, force: query.data.refresh }); } catch { return reply.code(503).send({ error: { code: 'OBSERVATIONS_UNAVAILABLE', message: 'Wildfire observations are temporarily unavailable.', retryable: true } }); } });
  app.get('/api/status', async () => resolved.events.getStatus(observations.status()));
  app.get('/api/geocode', async (request, reply) => { const query = geocodeQuerySchema.safeParse(request.query); if (!query.success) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Enter 2–120 characters.' } }); try { return { results: await resolved.geocode.search(query.data.q) }; } catch { return reply.code(503).send({ error: { code: 'GEOCODER_UNAVAILABLE', message: 'Location search is temporarily unavailable.', retryable: true } }); } });
  app.setNotFoundHandler(async (request, reply) => {
    const webRoot = process.env.WEB_DIST_DIR ?? join(process.cwd(), 'apps/web/dist');
    if (request.method === 'GET' && !request.url.startsWith('/api') && existsSync(webRoot)) {
      const requestedPath = request.url.split('?')[0] ?? '/';
      const candidate = join(webRoot, requestedPath === '/' ? 'index.html' : requestedPath.slice(1));
      const filePath = existsSync(candidate) ? candidate : join(webRoot, 'index.html');
      return reply.type(contentTypes[extname(filePath)] ?? 'application/octet-stream').send(await readFile(filePath));
    }
    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  }); return app;
}
