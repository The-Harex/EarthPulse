import { z } from 'zod';

export const severitySchema = z.enum(['low', 'moderate', 'high', 'severe', 'extreme']);
export type Severity = z.infer<typeof severitySchema>;
export const eventLifecycleSchema = z.enum(['active', 'ended', 'expired', 'historical']);
export type EventLifecycle = z.infer<typeof eventLifecycleSchema>;
export const earthEventTypeSchema = z.enum(['earthquake', 'wildfire', 'storm', 'flood', 'volcano', 'drought', 'landslide', 'weather-alert', 'ice', 'dust', 'other']);
export type EarthEventType = z.infer<typeof earthEventTypeSchema>;

const pointGeometrySchema = z.object({ type: z.literal('Point'), coordinates: z.tuple([z.number(), z.number()]) });
const polygonGeometrySchema = z.object({ type: z.literal('Polygon'), coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1) });
const multiPolygonGeometrySchema = z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(z.array(z.array(z.tuple([z.number(), z.number()])))).min(1) });
export const earthGeometrySchema = z.union([pointGeometrySchema, polygonGeometrySchema, multiPolygonGeometrySchema]);
export type EarthGeometry = z.infer<typeof earthGeometrySchema>;

export const earthquakeMetadataSchema = z.object({ kind: z.literal('earthquake'), magnitude: z.number(), depthKm: z.number(), place: z.string().optional(), significance: z.number().optional(), tsunami: z.boolean().optional() });
export const eonetMetadataSchema = z.object({ kind: z.literal('eonet'), category: z.string(), open: z.boolean(), magnitudeValue: z.number().optional(), magnitudeUnit: z.string().optional(), sources: z.array(z.object({ id: z.string().optional(), url: z.url() })).default([]), geometryHistory: z.array(z.object({ date: z.iso.datetime(), geometry: earthGeometrySchema })).max(50).default([]) });
export const weatherAlertMetadataSchema = z.object({ kind: z.literal('weather-alert'), providerEventId: z.string().optional(), event: z.string(), headline: z.string().optional(), areaDesc: z.string().optional(), urgency: z.string().optional(), certainty: z.string().optional(), effectiveAt: z.iso.datetime().optional(), expiresAt: z.iso.datetime().optional(), senderName: z.string().optional(), issuingOffice: z.string().optional() });

const earthEventBaseSchema = z.object({ id: z.string().min(1), type: earthEventTypeSchema, subtype: z.string().optional(), title: z.string().min(1), description: z.string().optional(), latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(), geometry: earthGeometrySchema.optional(), startedAt: z.iso.datetime(), updatedAt: z.iso.datetime().optional(), endedAt: z.iso.datetime().optional(), severity: severitySchema, severityScore: z.number().int().min(0).max(100), source: z.string().min(1), sourceUrl: z.url().optional() });
export const earthquakeEventSchema = earthEventBaseSchema.extend({ type: z.literal('earthquake'), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), metadata: earthquakeMetadataSchema });
export const eonetEventSchema = earthEventBaseSchema.extend({ metadata: eonetMetadataSchema });
export const weatherAlertEventSchema = earthEventBaseSchema.extend({ type: z.literal('weather-alert'), metadata: weatherAlertMetadataSchema });
export const earthEventSchema = z.union([earthquakeEventSchema, weatherAlertEventSchema, eonetEventSchema]);
export type EarthquakeEvent = z.infer<typeof earthquakeEventSchema>;
export type EonetEvent = z.infer<typeof eonetEventSchema>;
export type WeatherAlertEvent = z.infer<typeof weatherAlertEventSchema>;
export type EarthEvent = z.infer<typeof earthEventSchema>;

/** Fields added by the persistent Phase 3 store. Adapters intentionally continue
 * to emit the lighter EarthEvent shape before ingestion. */
export const persistedEarthEventSchema = earthEventSchema.and(z.object({
  status: eventLifecycleSchema,
  firstSeenAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
}));
export type PersistedEarthEvent = z.infer<typeof persistedEarthEventSchema>;

export const earthObservationSchema = z.object({ id: z.string().min(1), type: z.literal('wildfire-detection'), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), observedAt: z.iso.datetime(), confidence: z.enum(['low', 'nominal', 'high', 'unknown']).optional(), source: z.string(), brightness: z.number().optional(), fireRadiativePower: z.number().optional(), satellite: z.string().optional(), instrument: z.string().optional(), metadata: z.record(z.string(), z.unknown()).default({}) });
export type EarthObservation = z.infer<typeof earthObservationSchema>;

export const environmentalConditionSchema = z.object({
  location: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }),
  observedAt: z.iso.datetime(),
  airQuality: z.object({
    aqi: z.number().nonnegative().optional(),
    category: z.string().optional(),
    pm25: z.number().nonnegative().optional(),
    pm10: z.number().nonnegative().optional(),
    ozone: z.number().nonnegative().optional(),
    nitrogenDioxide: z.number().nonnegative().optional(),
    carbonMonoxide: z.number().nonnegative().optional(),
    sulfurDioxide: z.number().nonnegative().optional(),
  }).optional(),
  source: z.string(),
  attribution: z.string().optional(),
});
export type EnvironmentalCondition = z.infer<typeof environmentalConditionSchema>;

export const spaceWeatherEventSchema = z.object({
  id: z.string(), type: z.string(), title: z.string(), description: z.string().optional(),
  startedAt: z.iso.datetime(), updatedAt: z.iso.datetime().optional(), severity: severitySchema.optional(),
  severityScore: z.number().int().min(0).max(100).optional(), source: z.string(), sourceUrl: z.url().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type SpaceWeatherEvent = z.infer<typeof spaceWeatherEventSchema>;
export const activityBandSchema = z.enum(['quiet', 'normal', 'active', 'elevated', 'intense']);
export type ActivityBand = z.infer<typeof activityBandSchema>;
export const spaceWeatherSummarySchema = z.object({
  currentKp: z.number().nonnegative().nullable(), geomagneticActivity: z.string(), solarActivity: z.string(),
  auroraPotential: z.string(), latestEvents: z.array(spaceWeatherEventSchema), updatedAt: z.iso.datetime().nullable(), source: z.string(),
});
export type SpaceWeatherSummary = z.infer<typeof spaceWeatherSummarySchema>;

export const providerStatusSchema = z.object({ configured: z.boolean(), healthy: z.boolean(), state: z.enum(['ok', 'stale', 'degraded', 'unavailable', 'unconfigured']), lastSuccess: z.iso.datetime().nullable(), cacheAgeSeconds: z.number().int().nonnegative().nullable(), errorCode: z.string().optional() });
export type ProviderStatus = z.infer<typeof providerStatusSchema>;
export const providersSchema = z.object({ usgs: providerStatusSchema, eonet: providerStatusSchema, firms: providerStatusSchema, nws: providerStatusSchema });
export type ProviderStatuses = z.infer<typeof providersSchema>;

export interface ActivitySummary { activeEvents: number; earthquakes: number; naturalEvents: number; significantWeatherAlerts: number; wildfireDetectionCount: number; strongestEarthquake: EarthquakeEvent | null; highestSeverityEvent: EarthEvent | null; pulseScore: number; pulseBand: 'quiet' | 'normal' | 'active' | 'elevated' | 'intense'; refreshedAt: string; }
export interface PulseCategory { category: 'seismic' | 'weather' | 'wildfire' | 'volcanic' | 'flood' | 'space-weather' | 'natural'; score: number; band: ActivityBand; }
export interface PulseSummary { score: number; band: ActivityBand; categories: PulseCategory[]; updatedAt: string; disclaimer: string; }
export const eventRelationSchema = z.object({ id: z.string(), eventIds: z.tuple([z.string(), z.string()]).optional(), subjectEventId: z.string().optional(), relatedEventId: z.string().optional(), kind: z.enum(['proximity', 'overlap', 'wildfire-activity', 'nearby', 'same-region', 'observation-support', 'possible-related']).transform((value) => value), score: z.number().min(0).max(100).optional(), reasons: z.array(z.string()).default([]), distanceKm: z.number().optional(), observationCount: z.number().int().positive().optional(), latestAt: z.iso.datetime().optional() });
export type EventRelation = z.infer<typeof eventRelationSchema>;

export const nearbySummarySchema = z.object({
  location: z.object({ latitude: z.number(), longitude: z.number(), label: z.string().optional() }), radiusKm: z.number().positive(),
  pulse: z.object({ score: z.number().int().min(0).max(100), band: activityBandSchema, disclaimer: z.string() }),
  events: z.array(earthEventSchema), counts: z.object({ earthquakes: z.number().int().nonnegative(), weatherAlerts: z.number().int().nonnegative(), naturalEvents: z.number().int().nonnegative(), fireDetections: z.number().int().nonnegative() }),
  environment: environmentalConditionSchema.optional(), updatedAt: z.iso.datetime(), freshness: z.record(z.string(), providerStatusSchema),
});
export type NearbySummary = z.infer<typeof nearbySummarySchema>;

export const eventsResponseSchema = z.object({ events: z.array(earthEventSchema), relations: z.array(eventRelationSchema).default([]), summary: z.custom<ActivitySummary>(), meta: z.object({ fetchedAt: z.iso.datetime(), servedAt: z.iso.datetime(), cache: z.enum(['fresh', 'stale', 'partial']), rejectedCount: z.number().int().nonnegative(), providers: providersSchema, warning: z.object({ code: z.string(), message: z.string() }).optional() }) });
export type EventsResponse = z.infer<typeof eventsResponseSchema>;
export const observationFeatureSchema = z.union([earthObservationSchema.extend({ kind: z.literal('observation') }), z.object({ kind: z.literal('cluster'), id: z.string(), latitude: z.number(), longitude: z.number(), count: z.number().int().positive(), latestAt: z.iso.datetime(), maxFireRadiativePower: z.number().optional() })]);
export type ObservationFeature = z.infer<typeof observationFeatureSchema>;
export const observationsResponseSchema = z.object({ features: z.array(observationFeatureSchema), totalDetections: z.number().int().nonnegative(), representation: z.enum(['clusters', 'observations']), meta: z.object({ fetchedAt: z.iso.datetime().nullable(), cache: z.enum(['fresh', 'stale', 'partial']), provider: providerStatusSchema }) });
export type ObservationsResponse = z.infer<typeof observationsResponseSchema>;

export const geocodeResultSchema = z.object({ id: z.string(), label: z.string(), latitude: z.number(), longitude: z.number(), boundingBox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional() });
export type GeocodeResult = z.infer<typeof geocodeResultSchema>;

export function classifySeverity(magnitude: number): Severity { if (magnitude < 3) return 'low'; if (magnitude < 4) return 'moderate'; if (magnitude < 5) return 'high'; if (magnitude < 6) return 'severe'; return 'extreme'; }
export function severityScore(magnitude: number): number { return Math.max(0, Math.min(100, Math.round(magnitude * 10))); }
export function filterEvents(events: EarthquakeEvent[], minMagnitude: number): EarthquakeEvent[] { return events.filter((event) => event.metadata.magnitude >= minMagnitude); }
export function filterEarthEvents(events: EarthEvent[], types: Set<EarthEventType>, severity?: Severity): EarthEvent[] { return events.filter((event) => types.has(event.type) && (!severity || event.severity === severity)); }
export function isEarthquake(event: EarthEvent): event is EarthquakeEvent { return event.metadata.kind === 'earthquake'; }

export interface ActivityStats { total: number; strongest: EarthquakeEvent | null; averageMagnitude: number; magnitudeFourPlus: number; activity: 'quiet' | 'active' | 'elevated'; }
export function calculateActivityStats(events: EarthquakeEvent[]): ActivityStats { if (!events.length) return { total: 0, strongest: null, averageMagnitude: 0, magnitudeFourPlus: 0, activity: 'quiet' }; const strongest = events.reduce((current, event) => event.metadata.magnitude > current.metadata.magnitude ? event : current); const averageMagnitude = events.reduce((sum, event) => sum + event.metadata.magnitude, 0) / events.length; const magnitudeFourPlus = events.filter((event) => event.metadata.magnitude >= 4).length; return { total: events.length, strongest, averageMagnitude, magnitudeFourPlus, activity: strongest.metadata.magnitude >= 6 || magnitudeFourPlus >= 10 ? 'elevated' : strongest.metadata.magnitude >= 5 || magnitudeFourPlus >= 4 ? 'active' : 'quiet' }; }
