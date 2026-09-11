import { ProviderError } from './providerError.js';

export class NwsProvider {
  constructor(private readonly url: string, private readonly userAgent: string) {}
  async fetchAlerts(): Promise<unknown> {
    let response: Response;
    try { response = await fetch(this.url, { headers: { accept: 'application/geo+json, application/json', 'user-agent': this.userAgent }, signal: AbortSignal.timeout(10_000) }); }
    catch { throw new ProviderError('upstream', 'NWS did not respond in time.'); }
    if (!response.ok) throw new ProviderError('upstream', `NWS returned status ${response.status}.`);
    try { return await response.json(); } catch { throw new ProviderError('malformed', 'NWS returned unreadable data.'); }
  }
}
