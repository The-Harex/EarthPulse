import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeocodeService } from './geocodeService.js';

describe('GeocodeService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('coalesces identical searches and spaces distinct upstream requests', async () => {
    vi.useFakeTimers();
    const start = Date.parse('2026-01-01T00:00:00.000Z');
    vi.setSystemTime(start);
    const requestTimes: number[] = [];
    const fetchMock = vi.fn(async () => {
      requestTimes.push(Date.now());
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = new GeocodeService('https://example.test', 'EarthPulse/Test', 1_000);

    const alpha = service.search('Alpha');
    const alphaDuplicate = service.search('alpha');
    const beta = service.search('Beta');
    const gamma = service.search('Gamma');
    await vi.runAllTimersAsync();
    await Promise.all([alpha, alphaDuplicate, beta, gamma]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(requestTimes).toEqual([start, start + 1_000, start + 2_000]);
  });
});
