import { AirQualityService } from './airQualityService.js';
import { EventRepository } from '../repositories/eventRepository.js';
import { ObservationRepository } from '../repositories/observationRepository.js';
import { ProviderStateRepository } from '../repositories/providerStateRepository.js';
import { PulseScoreService } from './pulseScoreService.js';

export class NearbyService {
  private readonly pulse = new PulseScoreService();
  constructor(private readonly events: EventRepository, private readonly observations: ObservationRepository, private readonly states: ProviderStateRepository, private readonly airQuality: AirQualityService) {}
  async get(latitude: number, longitude: number, radiusKm: number) {
    const [events, fireDetections, environment, states] = await Promise.all([this.events.nearby(latitude, longitude, radiusKm, 50), this.observations.countNearby(latitude, longitude, radiusKm), this.airQuality.current(latitude, longitude).catch(() => undefined), this.states.all()]);
    const aqi = environment?.airQuality?.aqi ?? null; return { location: { latitude, longitude }, radiusKm, pulse: this.pulse.local(events, fireDetections, aqi, radiusKm), events, counts: { earthquakes: events.filter((item) => item.type === 'earthquake').length, weatherAlerts: events.filter((item) => item.type === 'weather-alert').length, naturalEvents: events.filter((item) => item.metadata.kind === 'eonet').length, fireDetections }, ...(environment ? { environment } : {}), updatedAt: new Date().toISOString(), freshness: { ...states.providers, swpc: states.swpc } };
  }
}
