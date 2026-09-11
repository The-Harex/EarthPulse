import { adaptEonetEvents } from '../adapters/eonetAdapter.js';
import { adaptFirmsObservations } from '../adapters/firmsObservationAdapter.js';
import { adaptNwsAlerts } from '../adapters/nwsAlertAdapter.js';
import { adaptSwpcProducts } from '../adapters/swpcAdapter.js';
import { adaptUsgsFeed } from '../adapters/usgsEarthquakeAdapter.js';
import type { EarthPulseDatabase } from '../db/database.js';
import { EonetProvider } from '../providers/eonet.js';
import { FirmsProvider } from '../providers/firms.js';
import { NwsProvider } from '../providers/nws.js';
import { ProviderError } from '../providers/providerError.js';
import { SwpcProvider } from '../providers/swpc.js';
import { UsgsProvider } from '../providers/usgs.js';
import { EventRepository } from '../repositories/eventRepository.js';
import { ObservationRepository } from '../repositories/observationRepository.js';
import { ProviderStateRepository, type ProviderName } from '../repositories/providerStateRepository.js';
import { SpaceWeatherRepository } from '../repositories/spaceWeatherRepository.js';
import { providerRegistry } from './providerRegistry.js';

export interface IngestionProviders { usgs: Pick<UsgsProvider, 'fetchFeed'>; eonet: Pick<EonetProvider, 'fetchEvents'>; nws: Pick<NwsProvider, 'fetchAlerts'>; firms: Pick<FirmsProvider, 'fetchDetections' | 'configured'>; swpc: Pick<SwpcProvider, 'fetchProducts'> }
const errorCode = (error: unknown) => error instanceof ProviderError ? `PROVIDER_${error.kind.toUpperCase()}` : error instanceof Error && /valid|payload|response/i.test(error.message) ? 'PROVIDER_DATA_INVALID' : 'INGESTION_FAILED';

export class IngestionCoordinator {
  private readonly events: EventRepository; private readonly observations: ObservationRepository; private readonly state: ProviderStateRepository; private readonly spaceWeather: SpaceWeatherRepository;
  constructor(private readonly db: EarthPulseDatabase, private readonly providers: IngestionProviders, private readonly firmsSource: string) { this.events = new EventRepository(db); this.observations = new ObservationRepository(db); this.state = new ProviderStateRepository(db); this.spaceWeather = new SpaceWeatherRepository(db); }
  async runDue(now = new Date()) {
    return this.db.connection().execute(async (connection) => {
      const lock = await import('kysely').then(({ sql }) => sql<{ acquired: boolean }>`SELECT pg_try_advisory_lock(${1_938_472_031}) AS acquired`.execute(connection));
      if (!lock.rows[0]?.acquired) return { acquired: false, providers: [] as ProviderName[] };
      const completed: ProviderName[] = [];
      try { for (const registration of providerRegistry) if (await this.state.isDue(registration.name, registration.intervalMs, now)) { await this.ingest(registration.name, now); completed.push(registration.name); } }
      finally { await import('kysely').then(({ sql }) => sql`SELECT pg_advisory_unlock(${1_938_472_031})`.execute(connection)); }
      return { acquired: true, providers: completed };
    });
  }
  async ingest(provider: ProviderName, started = new Date()) {
    const startMs = Date.now(); let inserted = 0; let updated = 0; let rejected = 0;
    const configured = provider !== 'firms' || this.providers.firms.configured;
    if (!configured) { await this.state.record(provider, { configured: false, healthy: false, state: 'unconfigured', lastAttemptAt: started, durationMs: 0, inserted: 0, updated: 0, rejected: 0, errorCode: 'NOT_CONFIGURED' }); return; }
    try {
      if (provider === 'usgs') { const adapted = adaptUsgsFeed(await this.providers.usgs.fetchFeed()); rejected = adapted.rejectedCount; ({ inserted, updated } = await this.events.upsertBatch(provider, adapted.events, started)); }
      if (provider === 'eonet') { const adapted = adaptEonetEvents(await this.providers.eonet.fetchEvents()); rejected = adapted.rejectedCount; ({ inserted, updated } = await this.events.upsertBatch(provider, adapted.events, started)); }
      if (provider === 'nws') { const adapted = adaptNwsAlerts(await this.providers.nws.fetchAlerts()); rejected = adapted.rejectedCount; ({ inserted, updated } = await this.events.upsertBatch(provider, adapted.events, started)); await this.events.expireNws(started); }
      if (provider === 'firms') { const adapted = adaptFirmsObservations(await this.providers.firms.fetchDetections(), this.firmsSource); rejected = adapted.rejectedCount; ({ inserted } = await this.observations.insertBatch(provider, adapted.observations, started)); }
      if (provider === 'swpc') { const adapted = adaptSwpcProducts(await this.providers.swpc.fetchProducts()); rejected = adapted.rejectedCount; ({ inserted, updated } = await this.spaceWeather.upsertBatch(adapted.events, started)); }
      await this.state.record(provider, { configured: true, healthy: true, state: 'ok', lastAttemptAt: started, lastSuccessAt: new Date(), lastIngestedAt: new Date(), durationMs: Date.now() - startMs, inserted, updated, rejected });
    } catch (error) {
      await this.state.record(provider, { configured: true, healthy: false, state: 'degraded', lastAttemptAt: started, durationMs: Date.now() - startMs, inserted, updated, rejected, errorCode: errorCode(error) });
    }
  }
}

