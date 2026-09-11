import { describe, expect, it } from 'vitest';
import { calculateActivityStats, classifySeverity, filterEvents, severityScore, type EarthquakeEvent } from './index.js';

const event = (id: string, magnitude: number): EarthquakeEvent => ({
  id,
  type: 'earthquake',
  title: id,
  latitude: 0,
  longitude: 0,
  startedAt: '2026-01-01T00:00:00.000Z',
  severity: classifySeverity(magnitude),
  severityScore: severityScore(magnitude),
  source: 'USGS',
  metadata: { kind: 'earthquake', magnitude, depthKm: 10 },
});

describe('earthquake business rules', () => {
  it.each([[2.9, 'low'], [3, 'moderate'], [4, 'high'], [5, 'severe'], [6, 'extreme']])(
    'classifies %s as %s',
    (magnitude, severity) => expect(classifySeverity(magnitude as number)).toBe(severity),
  );
  it('clamps the visualization score', () => {
    expect(severityScore(-1)).toBe(0);
    expect(severityScore(4.56)).toBe(46);
    expect(severityScore(11)).toBe(100);
  });
  it('filters and aggregates events', () => {
    const events = [event('a', 3.5), event('b', 4.5), event('c', 6.2)];
    expect(filterEvents(events, 4).map(({ id }) => id)).toEqual(['b', 'c']);
    expect(calculateActivityStats(events)).toMatchObject({ total: 3, magnitudeFourPlus: 2, activity: 'elevated' });
  });
});
