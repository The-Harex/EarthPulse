import type { ProviderStatus, ProviderStatuses } from '@earth-pulse/shared';
import type { EarthPulseDatabase } from '../db/database.js';

export type ProviderName = 'usgs' | 'eonet' | 'nws' | 'firms' | 'swpc';
export interface ProviderRunResult { configured: boolean; healthy: boolean; state: ProviderStatus['state']; lastAttemptAt: Date; lastSuccessAt?: Date; lastIngestedAt?: Date; durationMs: number; inserted: number; updated: number; rejected: number; errorCode?: string }
const iso = (value: Date | string | null) => value == null ? null : new Date(value).toISOString();

export class ProviderStateRepository {
  constructor(private readonly db: EarthPulseDatabase) {}
  async record(provider: ProviderName, result: ProviderRunResult) {
    await this.db.insertInto('provider_state').values({ provider, configured: result.configured, healthy: result.healthy, state: result.state, last_attempt_at: result.lastAttemptAt, last_success_at: result.lastSuccessAt ?? null, last_ingested_at: result.lastIngestedAt ?? null, duration_ms: result.durationMs, inserted_count: result.inserted, updated_count: result.updated, rejected_count: result.rejected, error_code: result.errorCode ?? null })
      .onConflict((conflict) => conflict.column('provider').doUpdateSet({ configured: result.configured, healthy: result.healthy, state: result.state, last_attempt_at: result.lastAttemptAt, ...(result.lastSuccessAt ? { last_success_at: result.lastSuccessAt } : {}), ...(result.lastIngestedAt ? { last_ingested_at: result.lastIngestedAt } : {}), duration_ms: result.durationMs, inserted_count: result.inserted, updated_count: result.updated, rejected_count: result.rejected, error_code: result.errorCode ?? null, updated_at: new Date() })).execute();
  }
  async get(provider: ProviderName): Promise<ProviderStatus> {
    const row = await this.db.selectFrom('provider_state').selectAll().where('provider', '=', provider).executeTakeFirst();
    if (!row) return { configured: provider !== 'firms', healthy: false, state: provider === 'firms' ? 'unconfigured' : 'unavailable', lastSuccess: null, cacheAgeSeconds: null };
    const lastSuccess = iso(row.last_success_at); const age = lastSuccess ? Math.max(0, Math.floor((Date.now() - Date.parse(lastSuccess)) / 1000)) : null;
    return { configured: row.configured, healthy: row.healthy, state: row.state as ProviderStatus['state'], lastSuccess, cacheAgeSeconds: age, ...(row.error_code ? { errorCode: row.error_code } : {}) };
  }
  async all() {
    const [usgs, eonet, nws, firms, swpc] = await Promise.all([this.get('usgs'), this.get('eonet'), this.get('nws'), this.get('firms'), this.get('swpc')]);
    return { providers: { usgs, eonet, nws, firms } satisfies ProviderStatuses, swpc };
  }
  async isDue(provider: ProviderName, intervalMs: number, now = new Date()) {
    const row = await this.db.selectFrom('provider_state').select('last_attempt_at').where('provider', '=', provider).executeTakeFirst();
    return !row?.last_attempt_at || now.valueOf() - new Date(row.last_attempt_at).valueOf() >= intervalMs;
  }
}
