import type { EarthObservation, ObservationFeature, ObservationsResponse, ProviderStatus } from '@earth-pulse/shared';
import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import type { EarthPulseDatabase } from '../db/database.js';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const iso = (value: Date | string) => new Date(value).toISOString();
export interface ObservationQuery { bbox?: [number, number, number, number]; zoom?: number; limit?: number }

export class ObservationRepository {
  constructor(private readonly db: EarthPulseDatabase) {}

  async insertBatch(provider: string, observations: EarthObservation[], now = new Date()) {
    if (!observations.length) return { inserted: 0 };
    let inserted = 0;
    await this.db.transaction().execute(async (trx) => {
      for (const item of observations) {
        const result = await trx.insertInto('earth_observations').values({
          id: item.id, provider, provider_observation_id: item.id, type: item.type,
          geometry: sql`ST_SetSRID(ST_MakePoint(${item.longitude}, ${item.latitude}), 4326)`, latitude: item.latitude,
          longitude: item.longitude, observed_at: item.observedAt, confidence: item.confidence ?? null, source: item.source,
          brightness: item.brightness ?? null, fire_radiative_power: item.fireRadiativePower ?? null,
          satellite: item.satellite ?? null, instrument: item.instrument ?? null, metadata: item.metadata,
          content_hash: hash(item), ingested_at: now,
        }).onConflict((conflict) => conflict.columns(['provider', 'provider_observation_id']).doNothing()).executeTakeFirst();
        inserted += Number(result.numInsertedOrUpdatedRows ?? 0);
      }
    });
    return { inserted };
  }

  async query(input: ObservationQuery = {}, provider: ProviderStatus): Promise<ObservationsResponse> {
    const zoom = input.zoom ?? 1;
    const bounds = input.bbox ?? [-180, -90, 180, 90];
    const [west, south, east, north] = bounds;
    const intersects = west <= east
      ? sql<boolean>`ST_Intersects(geometry, ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326))`
      : sql<boolean>`ST_Intersects(geometry, ST_MakeEnvelope(${west}, ${south}, 180, ${north}, 4326)) OR ST_Intersects(geometry, ST_MakeEnvelope(-180, ${south}, ${east}, ${north}, 4326))`;
    const countRow = await this.db.selectFrom('earth_observations').select((eb) => eb.fn.countAll<number>().as('count')).executeTakeFirstOrThrow();
    let features: ObservationFeature[]; let representation: 'clusters' | 'observations';
    if (zoom >= 6) {
      const rows = await this.db.selectFrom('earth_observations').selectAll().where(intersects).orderBy('observed_at', 'desc').limit(Math.min(20_000, input.limit ?? 20_000)).execute();
      features = rows.map((row) => ({ kind: 'observation' as const, id: row.id, type: 'wildfire-detection' as const, latitude: row.latitude, longitude: row.longitude, observedAt: iso(row.observed_at), ...(row.confidence ? { confidence: row.confidence as EarthObservation['confidence'] } : {}), source: row.source, ...(row.brightness != null ? { brightness: row.brightness } : {}), ...(row.fire_radiative_power != null ? { fireRadiativePower: row.fire_radiative_power } : {}), ...(row.satellite ? { satellite: row.satellite } : {}), ...(row.instrument ? { instrument: row.instrument } : {}), metadata: row.metadata as Record<string, unknown> }));
      representation = 'observations';
    } else {
      const cell = zoom <= 2 ? 5 : zoom <= 4 ? 1 : 0.25;
      const cellSql = sql.raw(String(cell));
      const rows = await this.db.selectFrom('earth_observations').select([
        sql<string>`floor(longitude / ${cellSql})::text || ':' || floor(latitude / ${cellSql})::text`.as('cell_id'),
        sql<number>`floor(longitude / ${cellSql}) * ${cellSql} + ${cell / 2}`.as('grid_longitude'),
        sql<number>`floor(latitude / ${cellSql}) * ${cellSql} + ${cell / 2}`.as('grid_latitude'),
        sql<number>`count(*)::integer`.as('count'), sql<Date>`max(observed_at)`.as('latest_at'),
        sql<number | null>`max(fire_radiative_power)`.as('max_frp'),
      ]).where(intersects).groupBy(sql`floor(longitude / ${cellSql}), floor(latitude / ${cellSql})`).limit(20_000).execute();
      features = rows.map((row) => ({ kind: 'cluster' as const, id: `firms:grid:${cell}:${row.cell_id}`, latitude: row.grid_latitude, longitude: row.grid_longitude, count: row.count, latestAt: iso(row.latest_at), ...(row.max_frp != null ? { maxFireRadiativePower: row.max_frp } : {}) }));
      representation = 'clusters';
    }
    return { features, totalDetections: Number(countRow.count), representation, meta: { fetchedAt: provider.lastSuccess, cache: provider.state === 'ok' ? 'fresh' : 'stale', provider } };
  }

  async countNearby(latitude: number, longitude: number, radiusKm: number) {
    const row = await this.db.selectFrom('earth_observations').select((eb) => eb.fn.countAll<number>().as('count')).where(sql<boolean>`ST_DWithin(geometry::geography, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography, ${radiusKm * 1000})`).executeTakeFirstOrThrow();
    return Number(row.count);
  }
  async countAll() { const row = await this.db.selectFrom('earth_observations').select((eb) => eb.fn.countAll<number>().as('count')).executeTakeFirstOrThrow(); return Number(row.count); }
}
