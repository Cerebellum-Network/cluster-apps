import type { Challenge, SessionInfo, SourceError } from './types';

/** An error answer from the console backend, in its `{error, code}` envelope. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Set when the backend could not read a source (503 source_unavailable). */
  readonly source?: SourceError;

  constructor(status: number, code: string, message: string, source?: SourceError) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.source = source;
  }

  /** The session is gone or was never valid: sign in again. */
  get isUnauthorized() {
    return this.status === 401;
  }
}

type Fetch = typeof fetch;

export type Params = Record<string, string | number | undefined | null>;

export function query(params?: Params): string {
  if (!params) return '';
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && `${v}` !== '') q.set(k, `${v}`);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

async function parse<T>(res: Response): Promise<T> {
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    // An empty or non-JSON body: the status says enough.
  }
  if (!res.ok) {
    const code = typeof body.code === 'string' ? body.code : `http_${res.status}`;
    const message = typeof body.error === 'string' ? body.error : res.statusText || `HTTP ${res.status}`;
    const source =
      code === 'source_unavailable' && typeof body.source === 'string'
        ? {
            source: body.source,
            status: typeof body.source_status === 'number' ? body.source_status : undefined,
            detail: message,
          }
        : undefined;
    throw new ApiError(res.status, code, message, source);
  }
  return body as T;
}

/**
 * The console backend client. The session bearer is read per call, so a new
 * sign-in takes effect at once. The browser never holds an upstream key: it
 * asks the backend for named views only.
 */
export class ConsoleApi {
  constructor(
    private readonly baseUrl: string,
    private readonly token: () => string | null,
    private readonly fetchImpl: Fetch = (...args) => fetch(...args),
  ) {}

  async get<T>(path: string, params?: Params, signal?: AbortSignal): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const t = this.token();
    if (t) headers.Authorization = `Bearer ${t}`;
    const res = await this.fetchImpl(`${this.baseUrl}/api/v1${path}${query(params)}`, { headers, signal });
    return parse<T>(res);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}/api/v1${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    return parse<T>(res);
  }

  challenge(account: string) {
    return this.post<Challenge>('/auth/challenge', { account });
  }

  verify(req: { challenge_id: string; account: string; signature: string; scheme: 'ed25519' | 'sr25519' }) {
    return this.post<SessionInfo>('/auth/verify', req);
  }
}
