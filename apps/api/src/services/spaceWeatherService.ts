import { SpaceWeatherRepository } from '../repositories/spaceWeatherRepository.js';

export class SpaceWeatherService {
  constructor(private readonly repository: SpaceWeatherRepository) {}
  async summary() {
    const records = await this.repository.recent(100);
    const kpRecord = records.find((item) => item.kind === 'geomagnetic' && item.value != null);
    const kp = kpRecord?.value ?? null;
    const alerts = records.filter((item) => item.kind === 'alert');
    return {
      currentKp: kp,
      geomagneticActivity: kp == null ? 'Data unavailable' : kp >= 8 ? 'Extreme storm conditions' : kp >= 7 ? 'Severe storm conditions' : kp >= 5 ? 'Storm conditions' : kp >= 3 ? 'Unsettled' : 'Quiet',
      solarActivity: alerts.some((item) => ['severe', 'extreme'].includes(item.severity)) ? 'Significant alerts active' : alerts.length ? 'Advisories active' : 'No recent alerts',
      auroraPotential: kp == null ? 'Unknown' : kp >= 7 ? 'High at unusually low latitudes' : kp >= 5 ? 'Elevated at northern latitudes' : kp >= 3 ? 'Possible at high latitudes' : 'Low',
      latestEvents: records.slice(0, 25).map((item) => ({ id: item.id, type: item.kind, title: item.title, startedAt: item.observedAt, severity: item.severity, ...(item.value == null ? {} : { severityScore: Math.min(100, Math.round(item.value * 10)) }), source: 'NOAA SWPC', ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}), metadata: item.metadata as Record<string, unknown> })),
      updatedAt: records[0]?.observedAt ?? null,
      source: 'NOAA Space Weather Prediction Center',
    };
  }
}
