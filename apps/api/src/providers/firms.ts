import { ProviderError } from './providerError.js';

export class FirmsProvider {
  constructor(private readonly baseUrl: string, private readonly mapKey: string, private readonly source: string, private readonly dayRange: number) {}
  get configured() { return Boolean(this.mapKey); }
  async fetchDetections(): Promise<string> {
    if (!this.mapKey) throw new ProviderError('unconfigured', 'FIRMS_MAP_KEY is required.');
    const url = `${this.baseUrl}/${encodeURIComponent(this.mapKey)}/${encodeURIComponent(this.source)}/world/${Math.max(1, Math.min(5, this.dayRange))}`;
    let response: Response;
    try { response = await fetch(url, { headers: { accept: 'text/csv' }, signal: AbortSignal.timeout(20_000) }); }
    catch { throw new ProviderError('upstream', 'FIRMS did not respond in time.'); }
    if (!response.ok) throw new ProviderError('upstream', `FIRMS returned status ${response.status}.`);
    return response.text();
  }
}
