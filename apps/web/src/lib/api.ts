import { ERROR_CODES, type ApiError, type ErrorCode } from '@alvora/shared';

/**
 * Typed fetch client.
 *
 * Both the browser and the Next server reach the API through the same relative
 * `/api` prefix — nginx in production, a Next rewrite in development — so the
 * auth cookie is first-party in every environment. Server components pass the
 * incoming cookie header explicitly, since there is no browser to attach it.
 */

export class ApiRequestError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isAuthError(): boolean {
    return this.code === ERROR_CODES.UNAUTHENTICATED;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Forwarded from a server component so the request carries the session. */
  cookie?: string;
}

function baseUrl(): string {
  // On the server there is no origin to resolve a relative URL against.
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000/api';
  }
  return '/api';
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

let onUnauthenticated: (() => void) | null = null;

/** Registered by the auth provider so a 401 anywhere clears the cached session. */
export function setUnauthenticatedHandler(handler: (() => void) | null): void {
  onUnauthenticated = handler;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, cookie, headers, ...rest } = options;

  const requestHeaders = new Headers(headers);
  if (body !== undefined && !requestHeaders.has('content-type')) {
    requestHeaders.set('content-type', 'application/json');
  }
  if (cookie) requestHeaders.set('cookie', cookie);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      ...rest,
      headers: requestHeaders,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    // A network failure is not a protocol error; surface it as one shape anyway
    // so callers only ever handle ApiRequestError.
    throw new ApiRequestError(0, ERROR_CODES.INTERNAL, 'Serveur injoignable. Vérifiez votre connexion.', error);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    const error = (payload as ApiError | null)?.error;
    const code = (error?.code as ErrorCode) ?? ERROR_CODES.INTERNAL;
    if (code === ERROR_CODES.UNAUTHENTICATED && typeof window !== 'undefined') onUnauthenticated?.();
    throw new ApiRequestError(response.status, code, error?.message ?? 'Une erreur est survenue.', error?.details);
  }

  return payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'DELETE' }),
};

/** Paginated envelope every list endpoint returns. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
