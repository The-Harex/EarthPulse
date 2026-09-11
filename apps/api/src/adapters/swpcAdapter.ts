import { createHash } from 'node:crypto';

export type SpaceWeatherSeverity = 'low' | 'moderate' | 'high' | 'severe' | 'extreme';
export interface NormalizedSpaceWeatherEvent { id: string; providerEventId: string; kind: 'geomagnetic' | 'alert' | 'solar-wind'; title: string; observedAt: string; endedAt?: string; severity: SpaceWeatherSeverity; value?: number; unit?: string; sourceUrl: string; metadata: Record<string, unknown> }
const iso = (value: unknown) => { const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : null; return date && !Number.isNaN(date.valueOf()) ? date.toISOString() : null; };
const number = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; };
const severityForKp = (kp: number): SpaceWeatherSeverity => kp >= 8 ? 'extreme' : kp >= 7 ? 'severe' : kp >= 5 ? 'high' : kp >= 3 ? 'moderate' : 'low';
const stableId = (prefix: string, value: unknown) => `${prefix}:${createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 20)}`;

export function adaptSwpcProducts(payload: { kp: unknown; alerts: unknown; solarWind: unknown }) {
  const events: NormalizedSpaceWeatherEvent[] = []; let rejectedCount = 0;
  if (Array.isArray(payload.kp) && payload.kp.length > 1) {
    const header = Array.isArray(payload.kp[0]) ? payload.kp[0].map(String) : [];
    const timeIndex = header.findIndex((value) => /time/i.test(value)); const kpIndex = header.findIndex((value) => /kp/i.test(value));
    for (const raw of payload.kp.slice(1)) { if (!Array.isArray(raw)) { rejectedCount++; continue; } const observedAt = iso(raw[timeIndex]); const kp = number(raw[kpIndex]); if (!observedAt || kp == null) { rejectedCount++; continue; } const providerEventId = `kp:${observedAt}`; events.push({ id: `swpc:${providerEventId}`, providerEventId, kind: 'geomagnetic', title: `Planetary K-index ${kp.toFixed(1)}`, observedAt, severity: severityForKp(kp), value: kp, unit: 'Kp', sourceUrl: 'https://www.swpc.noaa.gov/', metadata: { raw } }); }
  }
  if (Array.isArray(payload.alerts)) for (const raw of payload.alerts) {
    if (!raw || typeof raw !== 'object') { rejectedCount++; continue; }
    const alert = raw as Record<string, unknown>; const observedAt = iso(alert.issue_datetime ?? alert.issueTime ?? alert.message); if (!observedAt) { rejectedCount++; continue; }
    const productId = String(alert.product_id ?? alert.productId ?? stableId('alert', raw)); const message = String(alert.message ?? alert.summary ?? 'NOAA SWPC alert');
    events.push({ id: `swpc:${productId}`, providerEventId: productId, kind: 'alert', title: message.split('\n')[0]!.slice(0, 180), observedAt, severity: /G[4-5]|S[4-5]|R5/i.test(message) ? 'extreme' : /G3|S3|R[3-4]/i.test(message) ? 'severe' : /warning|watch/i.test(message) ? 'high' : 'moderate', sourceUrl: 'https://www.swpc.noaa.gov/products/alerts-watches-and-warnings', metadata: alert });
  }
  if (Array.isArray(payload.solarWind) && payload.solarWind.length > 1) {
    const header = Array.isArray(payload.solarWind[0]) ? payload.solarWind[0].map(String) : []; const timeIndex = header.findIndex((value) => /time/i.test(value)); const speedIndex = header.findIndex((value) => /speed/i.test(value));
    const raw = payload.solarWind.at(-1); if (Array.isArray(raw)) { const observedAt = iso(raw[timeIndex]); const speed = number(raw[speedIndex]); if (observedAt && speed != null) { const providerEventId = `solar-wind:${observedAt}`; events.push({ id: `swpc:${providerEventId}`, providerEventId, kind: 'solar-wind', title: `Solar wind ${Math.round(speed)} km/s`, observedAt, severity: speed >= 800 ? 'high' : speed >= 600 ? 'moderate' : 'low', value: speed, unit: 'km/s', sourceUrl: 'https://www.swpc.noaa.gov/products/real-time-solar-wind', metadata: { raw } }); } }
  }
  return { events, rejectedCount };
}

