import { describe, expect, it } from 'vitest';
import { adaptFirmsObservations } from './firmsObservationAdapter.js';
describe('FIRMS adapter', () => { it('normalizes and de-duplicates detections', () => { const csv = 'latitude,longitude,acq_date,acq_time,confidence,frp,satellite,instrument\n10,20,2026-01-01,1234,h,12.5,N20,VIIRS\n10,20,2026-01-01,1234,h,12.5,N20,VIIRS'; const result = adaptFirmsObservations(csv, 'VIIRS_NOAA20_NRT'); expect(result.observations).toHaveLength(1); expect(result.observations[0]).toMatchObject({ confidence: 'high', fireRadiativePower: 12.5 }); }); });
