import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

type Timestamp = ColumnType<Date, Date | string, Date | string>;
type Json = ColumnType<unknown, unknown, unknown>;
type Geometry = ColumnType<string, string, string>;

export interface EarthEventsTable {
  id: string;
  provider: string;
  provider_event_id: string;
  type: string;
  subtype: string | null;
  title: string;
  description: string | null;
  geometry: Geometry;
  latitude: number | null;
  longitude: number | null;
  started_at: Timestamp;
  updated_at: Timestamp | null;
  ended_at: Timestamp | null;
  status: string;
  severity: string;
  severity_score: number;
  source: string;
  source_url: string | null;
  metadata: Json;
  content_hash: string;
  first_seen_at: Timestamp;
  last_seen_at: Timestamp;
  created_at: Generated<Timestamp>;
}

export interface EarthObservationsTable {
  id: string;
  provider: string;
  provider_observation_id: string;
  type: string;
  geometry: Geometry;
  latitude: number;
  longitude: number;
  observed_at: Timestamp;
  confidence: string | null;
  source: string;
  brightness: number | null;
  fire_radiative_power: number | null;
  satellite: string | null;
  instrument: string | null;
  metadata: Json;
  content_hash: string;
  ingested_at: Timestamp;
  created_at: Generated<Timestamp>;
}

export interface ProviderStateTable {
  provider: string;
  configured: boolean;
  healthy: boolean;
  state: string;
  last_attempt_at: Timestamp | null;
  last_success_at: Timestamp | null;
  last_ingested_at: Timestamp | null;
  duration_ms: number | null;
  inserted_count: number;
  updated_count: number;
  rejected_count: number;
  error_code: string | null;
  updated_at: Generated<Timestamp>;
}

export interface SpaceWeatherEventsTable {
  id: string;
  provider: string;
  provider_event_id: string;
  kind: string;
  title: string;
  observed_at: Timestamp;
  ended_at: Timestamp | null;
  severity: string;
  value: number | null;
  unit: string | null;
  source_url: string | null;
  metadata: Json;
  content_hash: string;
  first_seen_at: Timestamp;
  last_seen_at: Timestamp;
  created_at: Generated<Timestamp>;
}

export interface DatabaseSchema {
  earth_events: EarthEventsTable;
  earth_observations: EarthObservationsTable;
  provider_state: ProviderStateTable;
  space_weather_events: SpaceWeatherEventsTable;
}

export type EarthEventRow = Selectable<EarthEventsTable>;
export type NewEarthEventRow = Insertable<EarthEventsTable>;
export type EarthEventUpdate = Updateable<EarthEventsTable>;
export type EarthObservationRow = Selectable<EarthObservationsTable>;
export type SpaceWeatherRow = Selectable<SpaceWeatherEventsTable>;

