import { ProviderError } from './providerError.js';
export { ProviderError } from './providerError.js';

export class UsgsProvider {
  constructor(private readonly feedUrl: string, private readonly userAgent: string) {}

  async fetchFeed(): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(this.feedUrl, {
        headers: { accept: 'application/geo+json, application/json', 'user-agent': this.userAgent },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ProviderError('upstream', 'USGS did not respond in time.');
    }
    if (!response.ok) throw new ProviderError('upstream', `USGS returned status ${response.status}.`);
    try {
      return await response.json();
    } catch {
      throw new ProviderError('malformed', 'USGS returned unreadable data.');
    }
  }
}
