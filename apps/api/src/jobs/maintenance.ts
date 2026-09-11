import { sql } from 'kysely';
import { config } from '../config.js';
import { createDatabase } from '../db/database.js';

const db = createDatabase(config.databaseUrl, config.databaseSsl); const batch = Math.min(50_000, Math.max(100, config.retentionBatchSize));
try {
  await sql`DELETE FROM earth_events WHERE ctid IN (SELECT ctid FROM earth_events WHERE status <> 'active' AND ((provider = 'usgs' AND started_at < now() - (${config.earthquakeRetentionDays} * interval '1 day')) OR (provider = 'nws' AND ended_at < now() - (${config.weatherRetentionDays} * interval '1 day')) OR (provider = 'eonet' AND ended_at < now() - (${config.eonetRetentionDays} * interval '1 day'))) LIMIT ${batch})`.execute(db);
  await sql`DELETE FROM earth_observations WHERE ctid IN (SELECT ctid FROM earth_observations WHERE observed_at < now() - (${config.firmsRetentionDays} * interval '1 day') LIMIT ${batch})`.execute(db);
  await sql`DELETE FROM space_weather_events WHERE ctid IN (SELECT ctid FROM space_weather_events WHERE observed_at < now() - (${config.spaceWeatherRetentionDays} * interval '1 day') LIMIT ${batch})`.execute(db);
} finally { await db.destroy(); }

