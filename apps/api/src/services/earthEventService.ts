import type { ActivitySummary, EarthEvent, EarthEventType, EventsResponse, ProviderStatuses, Severity } from '@earth-pulse/shared';
import { isEarthquake } from '@earth-pulse/shared';
import { adaptEonetEvents } from '../adapters/eonetAdapter.js';
import { adaptNwsAlerts } from '../adapters/nwsAlertAdapter.js';
import { adaptUsgsFeed } from '../adapters/usgsEarthquakeAdapter.js';
import { EonetProvider } from '../providers/eonet.js';
import { NwsProvider } from '../providers/nws.js';
import { ProviderError } from '../providers/providerError.js';
import { UsgsProvider } from '../providers/usgs.js';
import { ProviderCache } from './providerCache.js';
import { buildRelations } from './relations.js';

type DiscreteSnapshot = { events: EarthEvent[]; rejectedCount: number };
export interface EventQuery { types?: EarthEventType[] | undefined; severity?: Severity | undefined; source?: string | undefined; minMagnitude?: number | undefined; }

const band = (score: number): ActivitySummary['pulseBand'] => score <= 20 ? 'quiet' : score <= 40 ? 'normal' : score <= 60 ? 'active' : score <= 80 ? 'elevated' : 'intense';
const severityWeight: Record<Severity, number> = { low: 0.5, moderate: 1, high: 2, severe: 4, extreme: 7 };
const decay = (at: string, halfLifeHours: number, now: number) => Math.exp(-Math.LN2 * Math.max(0, now - Date.parse(at)) / (halfLifeHours * 3_600_000));

export class EarthEventService {
  private readonly usgs: ProviderCache<DiscreteSnapshot>;
  private readonly eonet: ProviderCache<DiscreteSnapshot> | undefined;
  private readonly nws: ProviderCache<DiscreteSnapshot> | undefined;
  constructor(usgsProvider: Pick<UsgsProvider, 'fetchFeed'>, ttlMs = 120_000, cooldownMs = 30_000, maxStaleMs = 30 * 60_000, eonetProvider?: Pick<EonetProvider, 'fetchEvents'>, nwsProvider?: Pick<NwsProvider, 'fetchAlerts'>, eonetTtlMs = 900_000) {
    this.usgs = new ProviderCache(true, async () => adaptUsgsFeed(await usgsProvider.fetchFeed()), ttlMs, cooldownMs, maxStaleMs);
    this.eonet = eonetProvider ? new ProviderCache(true, async () => adaptEonetEvents(await eonetProvider.fetchEvents()), eonetTtlMs, cooldownMs, maxStaleMs) : undefined;
    this.nws = nwsProvider ? new ProviderCache(true, async () => adaptNwsAlerts(await nwsProvider.fetchAlerts()), ttlMs, cooldownMs, maxStaleMs) : undefined;
  }
  async getEvents(force = false, query: EventQuery = {}, wildfireDetectionCount = 0): Promise<EventsResponse> {
    const readers = [this.usgs.get(force), this.eonet?.get(force), this.nws?.get(force)].filter(Boolean) as Promise<{ value: DiscreteSnapshot; cache: 'fresh' | 'stale'; fetchedAt: string }>[];
    const results = await Promise.allSettled(readers); const good = results.filter((result): result is PromiseFulfilledResult<{ value: DiscreteSnapshot; cache: 'fresh' | 'stale'; fetchedAt: string }> => result.status === 'fulfilled').map((result) => result.value);
    if (!good.length) throw new ProviderError('upstream', 'No event providers are available.');
    const unfiltered = good.flatMap((result) => result.value.events).sort((a, b) => Date.parse(b.updatedAt ?? b.startedAt) - Date.parse(a.updatedAt ?? a.startedAt));
    const events = unfiltered.filter((event) => (!query.types?.length || query.types.includes(event.type)) && (!query.severity || event.severity === query.severity) && (!query.source || event.source.toLowerCase().includes(query.source.toLowerCase())) && (!query.minMagnitude || !isEarthquake(event) || event.metadata.magnitude >= query.minMagnitude));
    const providers = this.providers(); const cache = results.some((result) => result.status === 'rejected') ? 'partial' : good.some((result) => result.cache === 'stale') ? 'stale' : 'fresh'; const rejectedCount = good.reduce((sum, item) => sum + item.value.rejectedCount, 0);
    const summary = this.summary(unfiltered, wildfireDetectionCount);
    return { events, relations: buildRelations(events), summary, meta: { fetchedAt: good.map((result) => result.fetchedAt).sort().at(-1)!, servedAt: new Date().toISOString(), cache, rejectedCount, providers, ...(cache !== 'fresh' ? { warning: { code: results.some((result) => result.status === 'rejected') ? 'PARTIAL_DATA' : 'UPSTREAM_UNAVAILABLE', message: 'One or more data sources are temporarily stale or unavailable.' } } : {}) } };
  }
  getEvent(id: string) { return this.getEvents().then((response) => response.events.find((event) => event.id === id) ?? null); }
  getStatus(firms?: ProviderStatuses['firms']) { const providers = this.providers(firms); const online = Object.values(providers).filter((provider) => provider.configured && provider.healthy).length; const configured = Object.values(providers).filter((provider) => provider.configured).length; return { status: online === configured ? 'ok' : online ? 'degraded' : 'unavailable', providers }; }
  private providers(firms?: ProviderStatuses['firms']): ProviderStatuses { const unavailable = { configured: false, healthy: false, state: 'unconfigured' as const, lastSuccess: null, cacheAgeSeconds: null }; return { usgs: this.usgs.status(), eonet: this.eonet?.status() ?? unavailable, nws: this.nws?.status() ?? unavailable, firms: firms ?? unavailable }; }
  private summary(events: EarthEvent[], wildfireDetectionCount: number): ActivitySummary { const now = Date.now(); const quakes = events.filter(isEarthquake); const strongestEarthquake = quakes.reduce<typeof quakes[number] | null>((current, event) => !current || event.metadata.magnitude > current.metadata.magnitude ? event : current, null); const highestSeverityEvent = events.reduce<EarthEvent | null>((current, event) => !current || event.severityScore > current.severityScore ? event : current, null); const quakeScore = Math.min(35, quakes.reduce((sum, event) => sum + Math.max(0, event.metadata.magnitude - 3) * 4 * decay(event.startedAt, 12, now), 0)); const alertScore = Math.min(30, events.filter((event) => event.type === 'weather-alert').reduce((sum, event) => sum + severityWeight[event.severity] * decay(event.updatedAt ?? event.startedAt, 6, now), 0)); const eonetScore = Math.min(20, events.filter((event) => event.metadata.kind === 'eonet').reduce((sum, event) => sum + severityWeight[event.severity] * decay(event.updatedAt ?? event.startedAt, 72, now), 0)); const fireScore = Math.min(15, 3 * Math.log(1 + wildfireDetectionCount / 100)); const pulseScore = Math.round(Math.min(100, quakeScore + alertScore + eonetScore + fireScore)); return { activeEvents: events.length, earthquakes: quakes.length, naturalEvents: events.filter((event) => event.metadata.kind === 'eonet').length, significantWeatherAlerts: events.filter((event) => event.type === 'weather-alert' && ['severe', 'extreme'].includes(event.severity)).length, wildfireDetectionCount, strongestEarthquake, highestSeverityEvent, pulseScore, pulseBand: band(pulseScore), refreshedAt: new Date().toISOString() }; }
}
