import type { ActivitySummary, EarthEvent } from '@earth-pulse/shared';
import { isEarthquake } from '@earth-pulse/shared';
import { EventRepository, type StoredEventQuery } from '../repositories/eventRepository.js';
import { ObservationRepository } from '../repositories/observationRepository.js';
import { ProviderStateRepository } from '../repositories/providerStateRepository.js';
import { EventCorrelationService } from './eventCorrelationService.js';
import { PulseScoreService } from './pulseScoreService.js';

const eventProviders = ['usgs', 'eonet', 'nws'] as const;
const liveWindowMs = 24 * 60 * 60 * 1_000;

/** Keep the default map and feed aligned to the product's rolling live window. */
export function withinLiveWindow(query: StoredEventQuery, now = new Date()): StoredEventQuery {
  if (query.from || query.to || query.cursor) return query;
  return { ...query, from: new Date(now.valueOf() - liveWindowMs).toISOString(), to: now.toISOString() };
}

/**
 * A single newest-first query is easily overwhelmed by high-volume NWS alerts.
 * Split unfiltered requests across the event providers so global views retain
 * earthquakes and EONET activity alongside weather alerts.
 */
export function balancedEventQueries(query: StoredEventQuery): StoredEventQuery[] {
  if (query.provider || query.source || query.types?.length || query.cursor) return [query];
  if (query.mapView) return eventProviders.map((provider) => ({ ...query, provider, limit: Math.min(2_000, query.limit ?? 2_000) }));
  const total = Math.min(2_000, Math.max(1, query.limit ?? 100));
  const base = Math.floor(total / eventProviders.length);
  const remainder = total % eventProviders.length;
  return eventProviders.map((provider, index) => ({ ...query, provider, limit: base + (index < remainder ? 1 : 0) }));
}

export class PersistedEarthEventService {
  private readonly pulse = new PulseScoreService(); private readonly correlations = new EventCorrelationService();
  constructor(private readonly events: EventRepository, private readonly observations: ObservationRepository, private readonly providerState: ProviderStateRepository) {}
  async getEvents(query: StoredEventQuery = {}) {
    const liveQuery = withinLiveWindow(query);
    const [eventGroups, state, fireCount] = await Promise.all([Promise.all(balancedEventQueries(liveQuery).map((eventQuery) => this.events.query(eventQuery))), this.providerState.all(), this.observations.countAll()]);
    const events = eventGroups.flat().sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt) || a.id.localeCompare(b.id));
    const providers = state.providers; const pulse = this.pulse.global(events); const fetchedAt = Object.values(providers).map((item) => item.lastSuccess).filter((item): item is string => Boolean(item)).sort().at(-1) ?? new Date(0).toISOString(); const degraded = Object.values(providers).some((item) => item.configured && !item.healthy);
    return { events, relations: [], summary: this.summary(events, fireCount, pulse.score, pulse.band), meta: { fetchedAt, servedAt: new Date().toISOString(), cache: degraded ? 'partial' as const : 'fresh' as const, rejectedCount: 0, providers, ...(degraded ? { warning: { code: 'PARTIAL_DATA', message: 'Stored data is available, but one or more ingestion providers are degraded.' } } : {}) } };
  }
  async getEvent(id: string) { return this.events.findById(id); }
  async getEventDetail(id: string) { const event = await this.events.findById(id); if (!event) return null; if (event.latitude == null || event.longitude == null) return { event, relations: [], highlights: { eventIds: [] } }; const candidates = await this.events.nearby(event.latitude, event.longitude, 120, 50); const relations = this.correlations.related(event, candidates); return { event, relations, highlights: { eventIds: relations.map((relation) => relation.relatedEventId).filter(Boolean) } }; }
  async getStatus() { const state = await this.providerState.all(); const online = Object.values(state.providers).filter((item) => item.configured && item.healthy).length; const configured = Object.values(state.providers).filter((item) => item.configured).length; return { status: online === configured ? 'ok' : online ? 'degraded' : 'unavailable', database: { ready: true }, ...state }; }
  async globalPulse() { const query = withinLiveWindow({ limit: 200 }); return this.pulse.global((await Promise.all(balancedEventQueries(query).map((item) => this.events.query(item))).then((groups) => groups.flat()))); }
  private summary(events: EarthEvent[], fireCount: number, pulseScore: number, pulseBand: ActivitySummary['pulseBand']): ActivitySummary { const quakes = events.filter(isEarthquake); return { activeEvents: events.length, earthquakes: quakes.length, naturalEvents: events.filter((event) => event.metadata.kind === 'eonet').length, significantWeatherAlerts: events.filter((event) => event.type === 'weather-alert' && ['severe', 'extreme'].includes(event.severity)).length, wildfireDetectionCount: fireCount, strongestEarthquake: quakes.reduce<typeof quakes[number] | null>((best, item) => !best || item.metadata.magnitude > best.metadata.magnitude ? item : best, null), highestSeverityEvent: events.reduce<EarthEvent | null>((best, item) => !best || item.severityScore > best.severityScore ? item : best, null), pulseScore, pulseBand, refreshedAt: new Date().toISOString() }; }
}
