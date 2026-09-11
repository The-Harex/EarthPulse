import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { EarthEventService } from './services/earthEventService.js';

const feed = { type: 'FeatureCollection', features: [{
  id: 'test', properties: { mag: 4.5, place: 'Test Ridge', time: 1_767_225_600_000, title: 'M 4.5 - Test Ridge' },
  geometry: { type: 'Point', coordinates: [1, 2, 3] },
}] };

describe('API routes', () => {
  it('returns normalized events and validates queries', async () => {
    const app = buildApp({ events: new EarthEventService({ fetchFeed: async () => feed }), geocode: { search: async () => [] } });
    const response = await app.inject('/api/events?minMagnitude=4');
    expect(response.statusCode).toBe(200);
    expect(response.json().events[0].id).toBe('test');
    expect((await app.inject('/api/events?type=wildfire')).json().events).toEqual([]);
    await app.close();
  });
  it('normalizes geocoder errors', async () => {
    const app = buildApp({ events: new EarthEventService({ fetchFeed: async () => feed }), geocode: { search: async () => { throw new Error('private'); } } });
    expect((await app.inject('/api/geocode?q=Boston')).statusCode).toBe(503);
    expect((await app.inject('/api/geocode?q=x')).statusCode).toBe(400);
    await app.close();
  });
});
