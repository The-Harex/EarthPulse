import type { EarthEvent, EarthEventType, Severity } from '@earth-pulse/shared';
import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import type { EarthPulseDatabase } from '../db/database.js';
import type { EarthEventRow } from '../db/types.js';

export type EventLifecycleStatus = 'active' | 'ended' | 'expired' | 'historical';
export type StoredEarthEvent = EarthEvent & { status: EventLifecycleStatus; firstSeenAt: string; lastSeenAt: string };
export interface StoredEventQuery {
  types?: EarthEventType[];
  severity?: Severity;
  provider?: string;
  source?: string;
  minMagnitude?: number;
  from?: string;
  to?: string;
  bbox?: [number, number, number, number];
  cursor?: string;
  limit?: number;
  mapView?: boolean;
}

interface SelectedEventRow extends EarthEventRow { geometry_json: string | null }
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const date = (value: Date | string | null) => value == null ? undefined : new Date(value).toISOString();
const providerId = (provider: string, event: EarthEvent) => {
  const stableProviderId = (event.metadata as Record<string, unknown>).providerEventId;
  if (typeof stableProviderId === 'string' && stableProviderId) return stableProviderId;
  return event.id.startsWith(`${provider}:`) ? event.id.slice(provider.length + 1) : event.id;
};

function lifecycle(event: EarthEvent, provider: string, now: Date): EventLifecycleStatus {
  if (provider === 'usgs') return 'historical';
  if (provider === 'nws' && event.endedAt && Date.parse(event.endedAt) <= now.valueOf()) return 'expired';
  if (provider === 'eonet' && event.endedAt) return 'ended';
  return 'active';
}

function geometry(event: EarthEvent) {
  return event.geometry ?? (event.latitude != null && event.longitude != null ? { type: 'Point' as const, coordinates: [event.longitude, event.latitude] as [number, number] } : null);
}

function fromRow(row: SelectedEventRow): StoredEarthEvent {
  const event = {
    id: row.id,
    type: row.type,
    ...(row.subtype ? { subtype: row.subtype } : {}),
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    latitude: row.latitude,
    longitude: row.longitude,
    ...(row.geometry_json ? { geometry: JSON.parse(row.geometry_json) } : {}),
    startedAt: date(row.started_at)!,
    ...(date(row.updated_at) ? { updatedAt: date(row.updated_at) } : {}),
    ...(date(row.ended_at) ? { endedAt: date(row.ended_at) } : {}),
    severity: row.severity,
    severityScore: row.severity_score,
    source: row.source,
    ...(row.source_url ? { sourceUrl: row.source_url } : {}),
    metadata: row.metadata,
    status: row.status,
    firstSeenAt: date(row.first_seen_at)!,
    lastSeenAt: date(row.last_seen_at)!,
  };
  return event as StoredEarthEvent;
}

export class EventRepository {
  constructor(private readonly db: EarthPulseDatabase) {}

  async upsertBatch(provider: string, events: EarthEvent[], now = new Date()) {
    if (!events.length) return { inserted: 0, updated: 0 };
    const ids = events.map((event) => providerId(provider, event));
    const existing = await this.db.selectFrom('earth_events').select(['provider_event_id', 'content_hash']).where('provider', '=', provider).where('provider_event_id', 'in', ids).execute();
    const known = new Map(existing.map((row) => [row.provider_event_id, row.content_hash]));
    let inserted = 0; let updated = 0;
    await this.db.transaction().execute(async (trx) => {
      for (const event of events) {
        const externalId = providerId(provider, event);
        const eventHash = hash(event);
        const eventGeometry = geometry(event);
        const changed = known.get(externalId) !== eventHash;
        if (!known.has(externalId)) inserted++; else if (changed) updated++;
        await trx.insertInto('earth_events').values({
          id: event.id, provider, provider_event_id: externalId, type: event.type, subtype: event.subtype ?? null,
          title: event.title, description: event.description ?? null,
          geometry: eventGeometry ? sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(eventGeometry)}), 4326)` : sql`ST_GeomFromText('POINT EMPTY', 4326)`,
          latitude: event.latitude, longitude: event.longitude, started_at: event.startedAt, updated_at: event.updatedAt ?? null,
          ended_at: event.endedAt ?? null, status: lifecycle(event, provider, now), severity: event.severity,
          severity_score: event.severityScore, source: event.source, source_url: event.sourceUrl ?? null,
          metadata: event.metadata, content_hash: eventHash, first_seen_at: now, last_seen_at: now,
        }).onConflict((conflict) => conflict.columns(['provider', 'provider_event_id']).doUpdateSet((eb) => ({
          id: eb.ref('excluded.id'), type: eb.ref('excluded.type'), subtype: eb.ref('excluded.subtype'), title: eb.ref('excluded.title'),
          description: eb.ref('excluded.description'), geometry: eb.ref('excluded.geometry'), latitude: eb.ref('excluded.latitude'),
          longitude: eb.ref('excluded.longitude'), started_at: eb.ref('excluded.started_at'), updated_at: eb.ref('excluded.updated_at'),
          ended_at: eb.ref('excluded.ended_at'), status: eb.ref('excluded.status'), severity: eb.ref('excluded.severity'),
          severity_score: eb.ref('excluded.severity_score'), source: eb.ref('excluded.source'), source_url: eb.ref('excluded.source_url'),
          metadata: eb.ref('excluded.metadata'), content_hash: eb.ref('excluded.content_hash'), last_seen_at: now,
        }))).execute();
      }
    });
    return { inserted, updated };
  }

  async query(input: StoredEventQuery = {}) {
    let query = this.db.selectFrom('earth_events').selectAll().select(sql<string | null>`CASE WHEN ST_IsEmpty(geometry) THEN NULL ELSE ST_AsGeoJSON(geometry) END`.as('geometry_json'));
    if (input.types?.length) query = query.where('type', 'in', input.types);
    if (input.severity) query = query.where('severity', '=', input.severity);
    if (input.provider) query = query.where('provider', '=', input.provider.toLowerCase());
    if (input.source) query = query.where(sql<boolean>`source ILIKE ${`%${input.source}%`}`);
    if (input.from) query = query.where('started_at', '>=', new Date(input.from));
    if (input.to) query = query.where('started_at', '<=', new Date(input.to));
    if (input.minMagnitude != null) query = query.where(sql<boolean>`type <> 'earthquake' OR COALESCE((metadata->>'magnitude')::double precision, 0) >= ${input.minMagnitude}`);
    if (input.cursor) query = query.where('started_at', '<', new Date(input.cursor));
    if (input.bbox) {
      const [west, south, east, north] = input.bbox;
      query = west <= east
        ? query.where(sql<boolean>`ST_Intersects(geometry, ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326))`)
        : query.where(sql<boolean>`ST_Intersects(geometry, ST_MakeEnvelope(${west}, ${south}, 180, ${north}, 4326)) OR ST_Intersects(geometry, ST_MakeEnvelope(-180, ${south}, ${east}, ${north}, 4326))`);
    }
    const rows = await query.orderBy('started_at', 'desc').orderBy('id').limit(Math.min(2_000, Math.max(1, input.limit ?? 100))).execute();
    return (rows as SelectedEventRow[]).map(fromRow);
  }

  async findById(id: string) {
    const row = await this.db.selectFrom('earth_events').selectAll().select(sql<string | null>`CASE WHEN ST_IsEmpty(geometry) THEN NULL ELSE ST_AsGeoJSON(geometry) END`.as('geometry_json')).where('id', '=', id).executeTakeFirst();
    return row ? fromRow(row as SelectedEventRow) : null;
  }

  async nearby(latitude: number, longitude: number, radiusKm: number, limit = 50) {
    const rows = await this.db.selectFrom('earth_events').selectAll()
      .select(sql<string | null>`CASE WHEN ST_IsEmpty(geometry) THEN NULL ELSE ST_AsGeoJSON(geometry) END`.as('geometry_json'))
      .select(sql<number>`ST_Distance(geometry::geography, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography) / 1000`.as('distance_km'))
      .where(sql<boolean>`NOT ST_IsEmpty(geometry) AND ST_DWithin(geometry::geography, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography, ${radiusKm * 1000})`)
      .orderBy(sql`geometry::geography <-> ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography`).limit(Math.min(50, limit)).execute();
    return rows.map((row) => ({ ...fromRow(row as SelectedEventRow), distanceKm: Number((row as { distance_km: number }).distance_km) }));
  }

  async countActive() { const result = await this.db.selectFrom('earth_events').select((eb) => eb.fn.countAll<number>().as('count')).where('status', '=', 'active').executeTakeFirstOrThrow(); return Number(result.count); }

  async expireNws(now = new Date()) { const result = await this.db.updateTable('earth_events').set({ status: 'expired' }).where('provider', '=', 'nws').where('status', '=', 'active').where('ended_at', '<=', now).executeTakeFirst(); return Number(result.numUpdatedRows); }
}
