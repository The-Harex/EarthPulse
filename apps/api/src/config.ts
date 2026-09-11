import { config as loadEnvironment } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

loadEnvironment({
  path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'),
  quiet: true,
});

export const config = {
  port: Number(process.env.PORT ?? 3001),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  usgsFeedUrl: process.env.USGS_FEED_URL ?? 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
  eonetUrl: process.env.EONET_URL ?? 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=500',
  nwsAlertsUrl: process.env.NWS_ALERTS_URL ?? 'https://api.weather.gov/alerts/active?status=actual',
  firmsBaseUrl: process.env.FIRMS_BASE_URL ?? 'https://firms.modaps.eosdis.nasa.gov/api/area/csv',
  firmsMapKey: process.env.FIRMS_MAP_KEY ?? '',
  firmsSource: process.env.FIRMS_SOURCE ?? 'VIIRS_NOAA20_NRT',
  firmsDayRange: Number(process.env.FIRMS_DAY_RANGE ?? 1),
  cacheTtlMs: Number(process.env.EVENT_CACHE_TTL_MS ?? 120_000),
  eonetCacheTtlMs: Number(process.env.EONET_CACHE_TTL_MS ?? 900_000),
  firmsCacheTtlMs: Number(process.env.FIRMS_CACHE_TTL_MS ?? 900_000),
  refreshCooldownMs: Number(process.env.EVENT_REFRESH_COOLDOWN_MS ?? 30_000),
  maxStaleMs: Number(process.env.EVENT_MAX_STALE_MS ?? 30 * 60_000),
  nominatimBaseUrl: process.env.NOMINATIM_BASE_URL ?? 'https://nominatim.openstreetmap.org',
  userAgent: process.env.GEOCODER_USER_AGENT ?? 'EarthPulse/0.2 (local development)',
  providerUserAgent: process.env.PROVIDER_USER_AGENT ?? 'EarthPulse/0.2 (local development)',
  databaseUrl: process.env.DATABASE_URL ?? '',
  databaseSsl: process.env.DATABASE_SSL === 'true',
  ingestionLoopMs: Number(process.env.INGESTION_LOOP_MS ?? 60_000),
  inProcessIngestion: process.env.IN_PROCESS_INGESTION === 'true',
  ingestionLockId: Number(process.env.INGESTION_LOCK_ID ?? 1_938_472_031),
  usgsIntervalMs: Number(process.env.USGS_INTERVAL_MS ?? 5 * 60_000),
  nwsIntervalMs: Number(process.env.NWS_INTERVAL_MS ?? 5 * 60_000),
  swpcIntervalMs: Number(process.env.SWPC_INTERVAL_MS ?? 5 * 60_000),
  eonetIntervalMs: Number(process.env.EONET_INTERVAL_MS ?? 15 * 60_000),
  firmsIntervalMs: Number(process.env.FIRMS_INTERVAL_MS ?? 15 * 60_000),
  swpcKpUrl: process.env.SWPC_KP_URL ?? 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
  swpcAlertsUrl: process.env.SWPC_ALERTS_URL ?? 'https://services.swpc.noaa.gov/products/alerts.json',
  swpcSolarWindUrl: process.env.SWPC_SOLAR_WIND_URL ?? 'https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json',
  openMeteoAirQualityUrl: process.env.OPEN_METEO_AIR_QUALITY_URL ?? 'https://air-quality-api.open-meteo.com/v1/air-quality',
  airQualityCacheTtlMs: Number(process.env.AIR_QUALITY_CACHE_TTL_MS ?? 30 * 60_000),
  earthquakeRetentionDays: Number(process.env.EARTHQUAKE_RETENTION_DAYS ?? 180),
  weatherRetentionDays: Number(process.env.WEATHER_RETENTION_DAYS ?? 60),
  eonetRetentionDays: Number(process.env.EONET_RETENTION_DAYS ?? 365),
  firmsRetentionDays: Number(process.env.FIRMS_RETENTION_DAYS ?? 14),
  spaceWeatherRetentionDays: Number(process.env.SPACE_WEATHER_RETENTION_DAYS ?? 90),
  retentionBatchSize: Number(process.env.RETENTION_BATCH_SIZE ?? 5_000),
};
