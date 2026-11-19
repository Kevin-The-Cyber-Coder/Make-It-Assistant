import { AppError } from '@make-it-ai/shared';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

export function buildAuthorizeUrl(config: OAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: (config.scopes ?? ['repo', 'read:user']).join(' '),
    state,
    allow_signup: 'true',
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeCode(
  config: OAuthConfig,
  code: string,
): Promise<{ accessToken: string; scope: string; tokenType: string }> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new AppError('UNAUTHORIZED', `GitHub OAuth failed with ${response.status}`);
  const body = await response.json() as {
    access_token?: string;
    scope?: string;
    token_type?: string;
    error?: string;
    error_description?: string;
  };
  if (body.error || !body.access_token) {
    throw new AppError('UNAUTHORIZED', body.error_description ?? body.error ?? 'GitHub did not return an access token');
  }
  return { accessToken: body.access_token, scope: body.scope ?? '', tokenType: body.token_type ?? 'bearer' };
}
