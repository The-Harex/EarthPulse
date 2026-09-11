import { type EarthEvent, type EarthEventType, type EarthGeometry, type Severity } from '@earth-pulse/shared';
import { z } from 'zod';

const geometrySchema = z.object({ date: z.string(), type: z.enum(['Point', 'Polygon', 'MultiPolygon']), coordinates: z.unknown() });
const eventSchema = z.object({ id: z.string(), title: z.string(), description: z.string().nullable().optional(), link: z.string().url().optional(), closed: z.string().nullable().optional(), categories: z.array(z.object({ id: z.string(), title: z.string() })).default([]), sources: z.array(z.object({ id: z.string().optional(), url: z.string().url() })).default([]), geometry: z.array(geometrySchema).default([]) });
const responseSchema = z.object({ events: z.array(z.unknown()) });
const mappings: Record<string, { type: EarthEventType; subtype: string; severity: Severity }> = {
  wildfires: { type: 'wildfire', subtype: 'active-event', severity: 'moderate' }, severeStorms: { type: 'storm', subtype: 'severe-storm', severity: 'high' }, floods: { type: 'flood', subtype: 'flood', severity: 'high' }, volcanoes: { type: 'volcano', subtype: 'volcanic-activity', severity: 'high' }, drought: { type: 'drought', subtype: 'drought', severity: 'moderate' }, landslides: { type: 'landslide', subtype: 'landslide', severity: 'high' }, seaLakeIce: { type: 'ice', subtype: 'sea-lake-ice', severity: 'moderate' }, dustHaze: { type: 'dust', subtype: 'dust-haze', severity: 'moderate' },
};

function geometry(raw: z.infer<typeof geometrySchema>): EarthGeometry | null {
  if (raw.type === 'Point' && Array.isArray(raw.coordinates) && raw.coordinates.length >= 2 && raw.coordinates.every((v) => typeof v === 'number')) return { type: 'Point', coordinates: [raw.coordinates[0] as number, raw.coordinates[1] as number] };
  if (raw.type === 'Polygon' || raw.type === 'MultiPolygon') {
    const candidate = { type: raw.type, coordinates: raw.coordinates };
    const parsed = raw.type === 'Polygon' ? z.object({ type: z.literal('Polygon'), coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1) }).safeParse(candidate) : z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(z.array(z.array(z.tuple([z.number(), z.number()])))).min(1) }).safeParse(candidate);
    return parsed.success ? parsed.data : null;
  }
  return null;
}
function centroid(value: EarthGeometry): [number, number] {
  const points: number[][] = value.type === 'Point' ? [value.coordinates] : value.type === 'Polygon' ? value.coordinates.flat() : value.coordinates.flat(2);
  return points.reduce<[number, number]>((acc, point) => [acc[0] + (point[0] ?? 0) / points.length, acc[1] + (point[1] ?? 0) / points.length], [0, 0]);
}

export function adaptEonetEvents(input: unknown): { events: EarthEvent[]; rejectedCount: number } {
  const response = responseSchema.safeParse(input); if (!response.success) throw new Error('Invalid EONET response.');
  const events: EarthEvent[] = []; let rejectedCount = 0;
  for (const raw of response.data.events) {
    const parsed = eventSchema.safeParse(raw); if (!parsed.success) { rejectedCount++; continue; }
    const item = parsed.data; const category = item.categories[0]; const mapped = mappings[category?.id ?? ''] ?? { type: 'other' as const, subtype: category?.title?.toLowerCase().replaceAll(' ', '-') ?? 'natural-event', severity: 'moderate' as Severity };
    const history = item.geometry.map((item) => { const value = geometry(item); const date = new Date(item.date); return value && !Number.isNaN(date.valueOf()) ? { date: date.toISOString(), geometry: value } : null; }).filter((value): value is { date: string; geometry: EarthGeometry } => value !== null).sort((a, b) => Date.parse(a.date) - Date.parse(b.date)).slice(-50);
    const current = history.at(-1); const [longitude, latitude] = current ? centroid(current.geometry) : [null, null];
    const startedAt = history[0]?.date ?? new Date().toISOString();
    events.push({ id: `eonet:${item.id}`, type: mapped.type, subtype: mapped.subtype, title: item.title, ...(item.description ? { description: item.description } : {}), latitude, longitude, ...(current ? { geometry: current.geometry, updatedAt: current.date } : {}), startedAt, ...(item.closed ? { endedAt: new Date(item.closed).toISOString() } : {}), severity: mapped.severity, severityScore: ({ low: 20, moderate: 40, high: 60, severe: 80, extreme: 100 } as const)[mapped.severity], source: 'NASA EONET', ...(item.link ? { sourceUrl: item.link } : {}), metadata: { kind: 'eonet', category: category?.title ?? 'Other', open: !item.closed, sources: item.sources, geometryHistory: history } });
  }
  return { events, rejectedCount };
}
