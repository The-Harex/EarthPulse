import { z } from 'zod';
import type { EnvironmentalCondition } from '@earth-pulse/shared';

const currentSchema = z.object({ time: z.string(), us_aqi: z.number().nullable().optional(), pm2_5: z.number().nullable().optional(), pm10: z.number().nullable().optional(), ozone: z.number().nullable().optional(), nitrogen_dioxide: z.number().nullable().optional(), carbon_monoxide: z.number().nullable().optional(), sulphur_dioxide: z.number().nullable().optional() });
const responseSchema = z.object({ current: currentSchema });
const category = (aqi: number | null) => aqi == null ? 'Unavailable' : aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : aqi <= 150 ? 'Unhealthy for sensitive groups' : aqi <= 200 ? 'Unhealthy' : aqi <= 300 ? 'Very unhealthy' : 'Hazardous';

export class AirQualityService {
  private readonly cache = new Map<string, { expires: number; value: EnvironmentalCondition }>();
  constructor(private readonly baseUrl: string, private readonly ttlMs = 30 * 60_000) {}
  async current(latitude: number, longitude: number): Promise<EnvironmentalCondition> {
    const lat = Number(latitude.toFixed(2)); const lon = Number(longitude.toFixed(2)); const key = `${lat},${lon}`; const cached = this.cache.get(key); if (cached && cached.expires > Date.now()) return cached.value;
    const url = new URL(this.baseUrl); url.searchParams.set('latitude', String(lat)); url.searchParams.set('longitude', String(lon)); url.searchParams.set('current', 'us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,carbon_monoxide,sulphur_dioxide'); url.searchParams.set('timezone', 'UTC');
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000) }); if (!response.ok) throw new Error('Air-quality provider unavailable.'); const parsed = responseSchema.parse(await response.json()); const item = parsed.current;
    const airQuality = { ...(item.us_aqi != null ? { aqi: item.us_aqi, category: category(item.us_aqi) } : {}), ...(item.pm2_5 != null ? { pm25: item.pm2_5 } : {}), ...(item.pm10 != null ? { pm10: item.pm10 } : {}), ...(item.ozone != null ? { ozone: item.ozone } : {}), ...(item.nitrogen_dioxide != null ? { nitrogenDioxide: item.nitrogen_dioxide } : {}), ...(item.carbon_monoxide != null ? { carbonMonoxide: item.carbon_monoxide } : {}), ...(item.sulphur_dioxide != null ? { sulfurDioxide: item.sulphur_dioxide } : {}) };
    const value: EnvironmentalCondition = { location: { latitude, longitude }, observedAt: new Date(item.time.endsWith('Z') ? item.time : `${item.time}Z`).toISOString(), airQuality, source: 'Open-Meteo/CAMS model estimate', attribution: 'Air quality data: Open-Meteo, CAMS ENSEMBLE data provider.' };
    this.cache.set(key, { expires: Date.now() + this.ttlMs, value }); return value;
  }
}
