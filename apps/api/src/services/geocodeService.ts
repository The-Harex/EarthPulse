import { geocodeResultSchema, type GeocodeResult } from '@earth-pulse/shared';
import { z } from 'zod';

const rawResultSchema = z.object({
  place_id: z.union([z.number(), z.string()]),
  display_name: z.string(),
  lat: z.string(),
  lon: z.string(),
  boundingbox: z.array(z.string()).length(4).optional(),
});

export class GeocodeService {
  private readonly cache = new Map<string, { expiresAt: number; results: GeocodeResult[] }>();
  private readonly inFlight = new Map<string, Promise<GeocodeResult[]>>();
  private nextAllowedAt = 0;
  private limiter: Promise<void> = Promise.resolve();

  constructor(
    private readonly baseUrl: string,
    private readonly userAgent: string,
    private readonly minimumIntervalMs = 1_000,
  ) {}

  async search(query: string): Promise<GeocodeResult[]> {
    const key = query.trim().toLocaleLowerCase();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.results;
    const running = this.inFlight.get(key);
    if (running) return running;
    const promise = this.fetchResults(query.trim()).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }

  private async fetchResults(query: string): Promise<GeocodeResult[]> {
    const turn = this.limiter.then(async () => {
      const delay = Math.max(0, this.nextAllowedAt - Date.now());
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      this.nextAllowedAt = Date.now() + this.minimumIntervalMs;
    });
    this.limiter = turn.catch(() => undefined);
    await turn;
    const url = new URL('/search', this.baseUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '5');
    const response = await fetch(url, {
      headers: { accept: 'application/json', 'accept-language': 'en', 'user-agent': this.userAgent },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('Location search is temporarily unavailable.');
    const raw = z.array(rawResultSchema).parse(await response.json());
    const results = raw.flatMap((item) => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);
      const box = item.boundingbox?.map(Number);
      const candidate = {
        id: String(item.place_id), label: item.display_name, latitude, longitude,
        ...(box?.length === 4 ? { boundingBox: [box[2], box[0], box[3], box[1]] } : {}),
      };
      const parsed = geocodeResultSchema.safeParse(candidate);
      return parsed.success ? [parsed.data] : [];
    });
    this.cache.set(query.toLocaleLowerCase(), { expiresAt: Date.now() + 86_400_000, results });
    if (this.cache.size > 250) this.cache.delete(this.cache.keys().next().value as string);
    return results;
  }
}
