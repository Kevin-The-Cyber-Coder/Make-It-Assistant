const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';
const TOKEN_KEY = 'mia.accessToken';
const REFRESH_KEY = 'mia.refreshToken';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken?: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (response.status === 401 && localStorage.getItem(REFRESH_KEY) && !path.includes('/auth/')) {
    const refreshToken = localStorage.getItem(REFRESH_KEY)!;
    const refreshed = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (refreshed.ok) {
      const body = await refreshed.json() as { tokens: { accessToken: string; refreshToken: string } };
      setTokens(body.tokens.accessToken, body.tokens.refreshToken);
      headers.set('Authorization', `Bearer ${body.tokens.accessToken}`);
      response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
    } else {
      clearTokens();
    }
  }

  const body = await parseBody(response) as { error?: { message?: string; code?: string; details?: unknown } } | null;
  if (!response.ok) {
    throw new ApiError(body?.error?.message ?? `Request failed (${response.status})`, response.status, body?.error?.code, body?.error?.details);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
  streamUrl: (path: string) => `${BASE_URL}${path}`,
  streamHeaders: (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  },
};
