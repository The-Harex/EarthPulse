import type { ProviderStatus } from '@earth-pulse/shared';
import { ProviderError } from '../providers/providerError.js';

export class ProviderCache<T> {
  private snapshot?: { value: T; fetchedAt: string };
  private inFlight: Promise<{ value: T; fetchedAt: string }> | undefined;
  private lastAttemptAt = 0;
  private lastError: ProviderError | undefined;
  constructor(private readonly configured: boolean, private readonly load: () => Promise<T>, private readonly ttlMs: number, private readonly cooldownMs: number, private readonly maxStaleMs: number) {}
  async get(force = false): Promise<{ value: T; cache: 'fresh' | 'stale'; fetchedAt: string }> {
    if (!this.configured) throw new ProviderError('unconfigured', 'Provider is not configured.');
    const age = this.snapshot ? Date.now() - Date.parse(this.snapshot.fetchedAt) : Infinity;
    if (this.snapshot && ((!force && age < this.ttlMs) || (force && Date.now() - this.lastAttemptAt < this.cooldownMs))) return { ...this.snapshot, cache: age < this.ttlMs ? 'fresh' : 'stale' };
    try { const snapshot = await this.refresh(); return { ...snapshot, cache: 'fresh' }; }
    catch (error) { const providerError = error instanceof ProviderError ? error : new ProviderError('malformed', 'Provider data could not be normalized.'); this.lastError = providerError; const staleAge = this.snapshot ? Date.now() - Date.parse(this.snapshot.fetchedAt) : Infinity; if (this.snapshot && staleAge <= this.maxStaleMs) return { ...this.snapshot, cache: 'stale' }; throw providerError; }
  }
  status(): ProviderStatus {
    if (!this.configured) return { configured: false, healthy: false, state: 'unconfigured', lastSuccess: null, cacheAgeSeconds: null };
    const ageMs = this.snapshot ? Date.now() - Date.parse(this.snapshot.fetchedAt) : null;
    const stale = ageMs != null && ageMs >= this.ttlMs;
    return { configured: true, healthy: Boolean(this.snapshot) && !this.lastError, state: !this.snapshot ? 'unavailable' : this.lastError ? (stale ? 'stale' : 'degraded') : 'ok', lastSuccess: this.snapshot?.fetchedAt ?? null, cacheAgeSeconds: ageMs == null ? null : Math.max(0, Math.floor(ageMs / 1000)), ...(this.lastError ? { errorCode: this.lastError.kind === 'unconfigured' ? 'UNCONFIGURED' : this.lastError.kind === 'upstream' ? 'UPSTREAM_UNAVAILABLE' : 'PROVIDER_DATA_INVALID' } : {}) };
  }
  private refresh() { if (this.inFlight) return this.inFlight; this.lastAttemptAt = Date.now(); this.inFlight = this.load().then((value) => { const snapshot = { value, fetchedAt: new Date().toISOString() }; this.snapshot = snapshot; this.lastError = undefined; return snapshot; }).finally(() => { this.inFlight = undefined; }); return this.inFlight; }
}
