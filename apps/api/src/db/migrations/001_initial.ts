import { sql, type Kysely } from 'kysely';
import type { DatabaseSchema } from '../types.js';

export async function up(db: Kysely<DatabaseSchema>) {
  await sql`CREATE EXTENSION IF NOT EXISTS postgis`.execute(db);
  await sql`
    CREATE TABLE IF NOT EXISTS earth_events (
      id text PRIMARY KEY,
      provider text NOT NULL,
      provider_event_id text NOT NULL,
      type text NOT NULL,
      subtype text,
      title text NOT NULL,
      description text,
      geometry geometry(Geometry, 4326) NOT NULL,
      latitude double precision,
      longitude double precision,
      started_at timestamptz NOT NULL,
      updated_at timestamptz,
      ended_at timestamptz,
      status text NOT NULL CHECK (status IN ('active', 'ended', 'expired', 'historical')),
      severity text NOT NULL,
      severity_score integer NOT NULL CHECK (severity_score BETWEEN 0 AND 100),
      source text NOT NULL,
      source_url text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      content_hash text NOT NULL,
      first_seen_at timestamptz NOT NULL,
      last_seen_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (provider, provider_event_id)
    )`.execute(db);
  await sql`
    CREATE TABLE IF NOT EXISTS earth_observations (
      id text PRIMARY KEY,
      provider text NOT NULL,
      provider_observation_id text NOT NULL,
      type text NOT NULL,
      geometry geometry(Point, 4326) NOT NULL,
      latitude double precision NOT NULL,
      longitude double precision NOT NULL,
      observed_at timestamptz NOT NULL,
      confidence text,
      source text NOT NULL,
      brightness double precision,
      fire_radiative_power double precision,
      satellite text,
      instrument text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      content_hash text NOT NULL,
      ingested_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (provider, provider_observation_id)
    )`.execute(db);
  await sql`
    CREATE TABLE IF NOT EXISTS provider_state (
      provider text PRIMARY KEY,
      configured boolean NOT NULL DEFAULT true,
      healthy boolean NOT NULL DEFAULT false,
      state text NOT NULL DEFAULT 'unavailable',
      last_attempt_at timestamptz,
      last_success_at timestamptz,
      last_ingested_at timestamptz,
      duration_ms integer,
      inserted_count integer NOT NULL DEFAULT 0,
      updated_count integer NOT NULL DEFAULT 0,
      rejected_count integer NOT NULL DEFAULT 0,
      error_code text,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  await sql`
    CREATE TABLE IF NOT EXISTS space_weather_events (
      id text PRIMARY KEY,
      provider text NOT NULL,
      provider_event_id text NOT NULL,
      kind text NOT NULL,
      title text NOT NULL,
      observed_at timestamptz NOT NULL,
      ended_at timestamptz,
      severity text NOT NULL,
      value double precision,
      unit text,
      source_url text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      content_hash text NOT NULL,
      first_seen_at timestamptz NOT NULL,
      last_seen_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (provider, provider_event_id)
    )`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS earth_events_geometry_gist ON earth_events USING gist (geometry)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS earth_events_geography_gist ON earth_events USING gist ((geometry::geography))`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS earth_events_filter_idx ON earth_events (type, status, started_at DESC)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS earth_events_provider_idx ON earth_events (provider, provider_event_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS earth_observations_geometry_gist ON earth_observations USING gist (geometry)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS earth_observations_geography_gist ON earth_observations USING gist ((geometry::geography))`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS earth_observations_time_idx ON earth_observations (observed_at DESC)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS space_weather_time_idx ON space_weather_events (kind, observed_at DESC)`.execute(db);
}

