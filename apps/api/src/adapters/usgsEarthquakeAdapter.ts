import { classifySeverity, severityScore, type EarthquakeEvent } from '@earth-pulse/shared';
import { z } from 'zod';

const collectionSchema = z.object({ type: z.literal('FeatureCollection'), features: z.array(z.unknown()) });
const featureSchema = z.object({
  id: z.string().min(1),
  properties: z.object({
    mag: z.number(),
    place: z.string().nullable().optional(),
    time: z.number().finite(),
    updated: z.number().finite().optional(),
    url: z.url().nullable().optional(),
    title: z.string().nullable().optional(),
    sig: z.number().finite().nullable().optional(),
    tsunami: z.number().int().nullable().optional(),
    type: z.string().nullable().optional(),
  }),
  geometry: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90), z.number().finite()]),
  }),
});

export interface AdaptedFeed { events: EarthquakeEvent[]; rejectedCount: number }

export function adaptUsgsFeed(input: unknown): AdaptedFeed {
  const collection = collectionSchema.safeParse(input);
  if (!collection.success) throw new Error('USGS payload is not a valid GeoJSON feature collection.');
  const events: EarthquakeEvent[] = [];
  let rejectedCount = 0;
  for (const raw of collection.data.features) {
    const parsed = featureSchema.safeParse(raw);
    if (!parsed.success) { rejectedCount += 1; continue; }
    const feature = parsed.data;
    const [longitude, latitude, depthKm] = feature.geometry.coordinates;
    const magnitude = feature.properties.mag;
    const title = feature.properties.title?.trim() || `M ${magnitude.toFixed(1)} earthquake`;
    const metadata: EarthquakeEvent['metadata'] = { kind: 'earthquake', magnitude, depthKm };
    if (feature.properties.place) metadata.place = feature.properties.place;
    if (feature.properties.sig != null) metadata.significance = feature.properties.sig;
    if (feature.properties.tsunami != null) metadata.tsunami = feature.properties.tsunami === 1;
    const event: EarthquakeEvent = {
      id: feature.id,
      type: 'earthquake',
      title,
      latitude,
      longitude,
      startedAt: new Date(feature.properties.time).toISOString(),
      severity: classifySeverity(magnitude),
      severityScore: severityScore(magnitude),
      source: 'USGS',
      metadata,
    };
    if (feature.properties.type) event.subtype = feature.properties.type;
    if (feature.properties.updated) event.updatedAt = new Date(feature.properties.updated).toISOString();
    if (feature.properties.url) event.sourceUrl = feature.properties.url;
    events.push(event);
  }
  events.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  if (events.length === 0 && collection.data.features.length > 0) {
    throw new Error('USGS payload contained no usable earthquake records.');
  }
  return { events, rejectedCount };
}
