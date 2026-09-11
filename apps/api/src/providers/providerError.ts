export class ProviderError extends Error {
  constructor(public readonly kind: 'upstream' | 'malformed' | 'unconfigured', message: string) {
    super(message);
    this.name = 'ProviderError';
  }
}
