import { describe, expect, it } from 'vitest';
import { adaptUsgsFeed } from './usgsEarthquakeAdapter.js';

const feature = (overrides: Record<string, unknown> = {}) => ({
  id: 'us7000test',
  properties: { mag: 5.2, place: 'South of Test Island', time: 1_767_225_600_000, updated: 1_767_225_601_000, url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000test', title: 'M 5.2 - South of Test Island', sig: 416, tsunami: 1, type: 'earthquake' },
  geometry: { type: 'Point', coordinates: [140.2, -20.4, 12.3] },
  ...overrides,
});

describe('adaptUsgsFeed', () => {
  it('normalizes valid USGS features', () => {
    const result = adaptUsgsFeed({ type: 'FeatureCollection', features: [feature()] });
    expect(result.rejectedCount).toBe(0);
    expect(result.events[0]).toMatchObject({
      id: 'us7000test', latitude: -20.4, longitude: 140.2, severity: 'severe', severityScore: 52,
      metadata: { magnitude: 5.2, depthKm: 12.3, significance: 416, tsunami: true },
    });
  });
  it('skips malformed features without discarding valid records', () => {
    const result = adaptUsgsFeed({ type: 'FeatureCollection', features: [feature(), feature({ id: '', geometry: null })] });
    expect(result.events).toHaveLength(1);
    expect(result.rejectedCount).toBe(1);
  });
  it('rejects a collection with no usable records', () => {
    expect(() => adaptUsgsFeed({ type: 'FeatureCollection', features: [feature({ geometry: null })] })).toThrow();
  });
});
