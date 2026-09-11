import { describe, expect, it } from 'vitest';
import { balancedEventQueries, withinLiveWindow } from './persistedEarthEventService.js';

describe('balancedEventQueries', () => {
  it('allocates an unfiltered global request across every event provider', () => {
    expect(balancedEventQueries({ limit: 100 })).toEqual([
      { provider: 'usgs', limit: 34 },
      { provider: 'eonet', limit: 33 },
      { provider: 'nws', limit: 33 },
    ]);
  });

  it('preserves a focused provider or type query', () => {
    expect(balancedEventQueries({ provider: 'usgs', limit: 25 })).toEqual([{ provider: 'usgs', limit: 25 }]);
    expect(balancedEventQueries({ types: ['earthquake'], limit: 25 })).toEqual([{ types: ['earthquake'], limit: 25 }]);
  });

  it('gives the map a full per-provider window instead of the feed allocation', () => {
    expect(balancedEventQueries({ mapView: true, limit: 500 })).toEqual([
      { mapView: true, provider: 'usgs', limit: 500 },
      { mapView: true, provider: 'eonet', limit: 500 },
      { mapView: true, provider: 'nws', limit: 500 },
    ]);
  });

  it('adds a rolling 24-hour range unless the caller explicitly supplies one', () => {
    const now = new Date('2026-09-11T12:00:00.000Z');
    expect(withinLiveWindow({}, now)).toEqual({ from: '2026-09-10T12:00:00.000Z', to: '2026-09-11T12:00:00.000Z' });
    expect(withinLiveWindow({ from: '2026-09-01T00:00:00.000Z' }, now)).toEqual({ from: '2026-09-01T00:00:00.000Z' });
  });
});
