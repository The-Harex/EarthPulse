import { createHash } from 'node:crypto';
import type { EarthPulseDatabase } from '../db/database.js';
import type { NormalizedSpaceWeatherEvent } from '../adapters/swpcAdapter.js';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const iso = (value: Date | string | null) => value == null ? undefined : new Date(value).toISOString();
export class SpaceWeatherRepository {
  constructor(private readonly db: EarthPulseDatabase) {}
  async upsertBatch(events: NormalizedSpaceWeatherEvent[], now = new Date()) {
    const ids = events.map((event) => event.providerEventId); const existing = ids.length ? await this.db.selectFrom('space_weather_events').select(['provider_event_id', 'content_hash']).where('provider', '=', 'swpc').where('provider_event_id', 'in', ids).execute() : [];
    const known = new Map(existing.map((row) => [row.provider_event_id, row.content_hash])); let inserted = 0; let updated = 0;
    await this.db.transaction().execute(async (trx) => { for (const event of events) { const contentHash = hash(event); if (!known.has(event.providerEventId)) inserted++; else if (known.get(event.providerEventId) !== contentHash) updated++; await trx.insertInto('space_weather_events').values({ id: event.id, provider: 'swpc', provider_event_id: event.providerEventId, kind: event.kind, title: event.title, observed_at: event.observedAt, ended_at: event.endedAt ?? null, severity: event.severity, value: event.value ?? null, unit: event.unit ?? null, source_url: event.sourceUrl, metadata: event.metadata, content_hash: contentHash, first_seen_at: now, last_seen_at: now }).onConflict((conflict) => conflict.columns(['provider', 'provider_event_id']).doUpdateSet((eb) => ({ title: eb.ref('excluded.title'), observed_at: eb.ref('excluded.observed_at'), ended_at: eb.ref('excluded.ended_at'), severity: eb.ref('excluded.severity'), value: eb.ref('excluded.value'), unit: eb.ref('excluded.unit'), source_url: eb.ref('excluded.source_url'), metadata: eb.ref('excluded.metadata'), content_hash: eb.ref('excluded.content_hash'), last_seen_at: now }))).execute(); } });
    return { inserted, updated };
  }
  async recent(limit = 100) { const rows = await this.db.selectFrom('space_weather_events').selectAll().orderBy('observed_at', 'desc').limit(Math.min(200, limit)).execute(); return rows.map((row) => ({ id: row.id, kind: row.kind, title: row.title, observedAt: iso(row.observed_at)!, ...(iso(row.ended_at) ? { endedAt: iso(row.ended_at) } : {}), severity: row.severity, ...(row.value != null ? { value: row.value } : {}), ...(row.unit ? { unit: row.unit } : {}), ...(row.source_url ? { sourceUrl: row.source_url } : {}), metadata: row.metadata })); }
}

