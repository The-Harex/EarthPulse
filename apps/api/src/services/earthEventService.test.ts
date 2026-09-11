import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderError } from '../providers/usgs.js';
import { EarthEventService } from './earthEventService.js';

const feed = { type: 'FeatureCollection', features: [{
  id: 'test', properties: { mag: 4.1, place: null, time: 1_767_225_600_000, title: null },
  geometry: { type: 'Point', coordinates: [1, 2, 3] },
}] };

describe('EarthEventService', () => {
  afterEach(() => vi.useRealTimers());

  it('caches fresh data and coalesces concurrent requests', async () => {
    const fetchFeed = vi.fn(async () => feed);
    const service = new EarthEventService({ fetchFeed }, 120_000, 0);
    const [a, b] = await Promise.all([service.getEvents(), service.getEvents()]);
    expect(fetchFeed).toHaveBeenCalledTimes(1);
    expect(a.events[0]?.id).toBe('test');
    expect(b.meta.cache).toBe('fresh');
    await service.getEvents();
    expect(fetchFeed).toHaveBeenCalledTimes(1);
  });
  it('serves stale data after an upstream failure', async () => {
    const fetchFeed = vi.fn().mockResolvedValueOnce(feed).mockRejectedValueOnce(new ProviderError('upstream', 'down'));
    const service = new EarthEventService({ fetchFeed }, 0, 0);
    await service.getEvents();
    const stale = await service.getEvents();
    expect(stale.meta.cache).toBe('stale');
    expect(stale.meta.warning?.code).toBe('UPSTREAM_UNAVAILABLE');
  });
  it('throws when no snapshot is available', async () => {
    const service = new EarthEventService({ fetchFeed: async () => { throw new ProviderError('upstream', 'down'); } }, 0, 0);
    await expect(service.getEvents()).rejects.toBeInstanceOf(ProviderError);
  });

  it('stops serving snapshots after the bounded stale window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const fetchFeed = vi.fn().mockResolvedValueOnce(feed).mockRejectedValueOnce(new ProviderError('upstream', 'down'));
    const service = new EarthEventService({ fetchFeed }, 0, 0, 60_000);
    await service.getEvents();
    vi.advanceTimersByTime(60_001);
    await expect(service.getEvents()).rejects.toBeInstanceOf(ProviderError);
  });
});
