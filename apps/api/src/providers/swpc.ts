import { ProviderError } from './providerError.js';

export interface SwpcPayload { kp: unknown; alerts: unknown; solarWind: unknown }
export class SwpcProvider {
  constructor(private readonly kpUrl: string, private readonly alertsUrl: string, private readonly solarWindUrl: string, private readonly userAgent: string) {}
  async fetchProducts(): Promise<SwpcPayload> {
    const load = async (url: string) => {
      let response: Response;
      try { response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': this.userAgent }, signal: AbortSignal.timeout(10_000) }); }
      catch { throw new ProviderError('upstream', 'NOAA SWPC did not respond in time.'); }
      if (!response.ok) throw new ProviderError('upstream', `NOAA SWPC returned status ${response.status}.`);
      try { return await response.json(); } catch { throw new ProviderError('malformed', 'NOAA SWPC returned unreadable data.'); }
    };
    const [kp, alerts, solarWind] = await Promise.all([load(this.kpUrl), load(this.alertsUrl), load(this.solarWindUrl)]);
    return { kp, alerts, solarWind };
  }
}

