import type { EarthEvent, PulseCategory, PulseSummary, Severity } from '@earth-pulse/shared';

const severity: Record<Severity, number> = { low: 0.2, moderate: 0.4, high: 0.6, severe: 0.8, extreme: 1 };
const typeWeight: Record<string, number> = { earthquake: 1, 'weather-alert': 0.9, storm: 0.9, wildfire: 0.8, volcano: 0.9, flood: 0.8, drought: 0.6, landslide: 0.7, ice: 0.4, dust: 0.4, other: 0.3 };
const band = (score: number): PulseSummary['band'] => score <= 20 ? 'quiet' : score <= 40 ? 'normal' : score <= 60 ? 'active' : score <= 80 ? 'elevated' : 'intense';
const category = (event: EarthEvent): PulseCategory['category'] => event.type === 'earthquake' ? 'seismic' : event.type === 'weather-alert' || event.type === 'storm' ? 'weather' : event.type === 'wildfire' ? 'wildfire' : event.type === 'volcano' ? 'volcanic' : event.type === 'flood' ? 'flood' : 'natural';

export class PulseScoreService {
  global(events: EarthEvent[], now = new Date()): PulseSummary {
    const grouped = new Map<PulseCategory['category'], EarthEvent[]>(); for (const event of events) grouped.set(category(event), [...(grouped.get(category(event)) ?? []), event]);
    const categories = [...grouped.entries()].map(([name, items]) => {
      const impact = Math.min(60, items.reduce((sum, item) => { const ageHours = Math.max(0, now.valueOf() - Date.parse(item.updatedAt ?? item.startedAt)) / 3_600_000; return sum + 12 * severity[item.severity] * (typeWeight[item.type] ?? 0.5) * Math.exp(-ageHours / 48); }, 0));
      const volume = Math.min(20, 20 * Math.log1p(items.length) / Math.log(101)); const cells = new Set(items.filter((item) => item.latitude != null && item.longitude != null).map((item) => `${Math.floor(item.latitude! / 10)}:${Math.floor(item.longitude! / 10)}`)).size; const spread = Math.min(10, cells); const score = Math.round(Math.min(100, impact + volume + spread)); return { category: name, score, band: band(score) };
    }).sort((a, b) => b.score - a.score);
    const highest = categories[0]?.score ?? 0; const average = categories.length ? categories.reduce((sum, item) => sum + item.score, 0) / categories.length : 0; const score = Math.round(0.7 * highest + 0.3 * average);
    return { score, band: band(score), categories, updatedAt: now.toISOString(), disclaimer: 'Pulse indicates unusual environmental activity, not personal danger or a safety forecast.' };
  }
  local(events: (EarthEvent & { distanceKm?: number })[], fireDetections: number, aqi: number | null, radiusKm: number, now = new Date()) {
    const contribution = (items: EarthEvent[], cap: number) => Math.min(cap, items.reduce((sum, item) => { const ageHours = Math.max(0, now.valueOf() - Date.parse(item.updatedAt ?? item.startedAt)) / 3_600_000; const distance = (item as EarthEvent & { distanceKm?: number }).distanceKm ?? 0; return sum + cap / 4 * severity[item.severity] * Math.exp(-ageHours / 48) * Math.max(0.1, 1 - distance / Math.max(1, radiusKm)); }, 0));
    const score = Math.round(Math.min(100, contribution(events.filter((item) => item.type === 'earthquake'), 30) + contribution(events.filter((item) => item.type === 'weather-alert'), 25) + contribution(events.filter((item) => item.metadata.kind === 'eonet'), 20) + Math.min(15, 3 * Math.log1p(fireDetections)) + (aqi == null || aqi <= 100 ? 0 : Math.min(10, (aqi - 100) / 20))));
    return { score, band: band(score), disclaimer: 'Local Pulse indicates unusual environmental activity nearby. It is not a measure of personal danger.' };
  }
}

