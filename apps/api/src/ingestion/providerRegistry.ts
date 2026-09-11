import { config } from '../config.js';
import type { ProviderName } from '../repositories/providerStateRepository.js';

export interface ProviderRegistration { name: ProviderName; intervalMs: number; timeoutMs: number; retries: number; lifecycle: 'historical' | 'explicit-close' | 'expires' | 'immutable' | 'observation' }
export const providerRegistry: ProviderRegistration[] = [
  { name: 'usgs', intervalMs: config.usgsIntervalMs, timeoutMs: 10_000, retries: 1, lifecycle: 'historical' },
  { name: 'nws', intervalMs: config.nwsIntervalMs, timeoutMs: 10_000, retries: 1, lifecycle: 'expires' },
  { name: 'swpc', intervalMs: config.swpcIntervalMs, timeoutMs: 10_000, retries: 1, lifecycle: 'observation' },
  { name: 'eonet', intervalMs: config.eonetIntervalMs, timeoutMs: 10_000, retries: 1, lifecycle: 'explicit-close' },
  { name: 'firms', intervalMs: config.firmsIntervalMs, timeoutMs: 20_000, retries: 0, lifecycle: 'immutable' },
];

