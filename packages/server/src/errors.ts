export class ServerError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) {
    super(message); this.name = 'ServerError';
  }
}

export const unavailable = () => new ServerError('NOT_FOUND', 'The requested resource is unavailable.', 404);
export const unauthenticated = () => new ServerError('UNAUTHENTICATED', 'Sign in again to continue.', 401);

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).sort().map(key => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}
