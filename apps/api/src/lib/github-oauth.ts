import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

export const GITHUB_OAUTH_COOKIE = 'mia_github_oauth';

const STATE_TTL_MS = 10 * 60 * 1000;
export const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

export interface OAuthState {
  userId: string;
  organizationId: string;
  expiresAt: number;
  nonce: string;
}

export interface OAuthTokenSession {
  accessToken: string;
  scope: string;
  login: string;
  expiresAt: number;
}

function key(secret: string): Buffer {
  return createHash('sha256').update(`${secret}:github-oauth-v1`).digest();
}

function encode(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function secureEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Creates a short-lived, HMAC-signed CSRF state bound to the current user. */
export function createOAuthState(secret: string, userId: string, organizationId: string): string {
  const payload: OAuthState = {
    userId,
    organizationId,
    expiresAt: Date.now() + STATE_TTL_MS,
    nonce: randomBytes(16).toString('hex'),
  };
  const body = encode(JSON.stringify(payload));
  const signature = createHmac('sha256', key(secret)).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function readOAuthState(secret: string, state: string): OAuthState | null {
  const [body, signature] = state.split('.');
  if (!body || !signature) return null;
  const expected = createHmac('sha256', key(secret)).update(body).digest('base64url');
  if (!secureEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthState;
    if (!payload.userId || !payload.organizationId || !payload.expiresAt || payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Encrypts the GitHub token so it never travels to or lives in the browser. */
export function sealOAuthToken(secret: string, session: OAuthTokenSession): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(session), 'utf8')),
    cipher.final(),
  ]);
  return `${encode(iv)}.${encode(cipher.getAuthTag())}.${encode(ciphertext)}`;
}

export function openOAuthToken(secret: string, sealed: string): OAuthTokenSession | null {
  const [ivPart, tagPart, dataPart] = sealed.split('.');
  if (!ivPart || !tagPart || !dataPart) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(secret), Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    const session = JSON.parse(plaintext) as OAuthTokenSession;
    if (!session.accessToken || !session.expiresAt || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function readOAuthCookie(request: Request): string | null {
  const raw = request.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === GITHUB_OAUTH_COOKIE) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return null;
}

export function oauthCookieOptions(
  prefix: string,
  secure: boolean,
  sameSite: 'lax' | 'none',
) {
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: prefix,
    maxAge: TOKEN_TTL_MS,
  } as const;
}
