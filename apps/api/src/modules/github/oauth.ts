import { Router } from 'express';
import { AppError } from '@make-it-ai/shared';
import { buildAuthorizeUrl, exchangeCode, GitHubClient } from '@make-it-ai/github-integration';
import type { AppContext } from '../../context';
import { audit } from '../../lib/audit';
import {
  createOAuthState,
  GITHUB_OAUTH_COOKIE,
  oauthCookieOptions,
  openOAuthToken,
  readOAuthCookie,
  readOAuthState,
  sealOAuthToken,
  TOKEN_TTL_MS,
} from '../../lib/github-oauth';
import { requireAuth } from '../../middleware';

export function createGithubOAuthRouter(context: AppContext): Router {
  const router = Router();
  const { env } = context;

  function oauthConfig() {
    if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET) {
      throw new AppError('BAD_REQUEST', 'GitHub OAuth is not configured on this server');
    }
    if (!env.GITHUB_OAUTH_REDIRECT_URI) {
      throw new AppError('BAD_REQUEST', 'GITHUB_OAUTH_REDIRECT_URI is not configured on this server');
    }
    return {
      clientId: env.GITHUB_OAUTH_CLIENT_ID,
      clientSecret: env.GITHUB_OAUTH_CLIENT_SECRET,
      redirectUri: env.GITHUB_OAUTH_REDIRECT_URI,
      scopes: env.GITHUB_OAUTH_SCOPES.split(',').map((scope) => scope.trim()).filter(Boolean),
    };
  }

  // GitHub redirects the browser here without a MAKE IT AI bearer token.
  router.get('/callback', async (request, response) => {
    const state = String(request.query.state ?? '');
    const code = String(request.query.code ?? '');
    const verified = readOAuthState(env.JWT_SECRET, state);
    if (!verified || !code) throw new AppError('BAD_REQUEST', 'Invalid or expired GitHub OAuth state');

    const config = oauthConfig();
    const { accessToken, scope } = await exchangeCode(config, code);
    let login = 'unknown';
    try {
      login = (await new GitHubClient(accessToken).getAuthenticatedUser()).login;
    } catch {
      // The token is valid for exchange; identity lookup is best-effort.
    }

    response.cookie(
      GITHUB_OAUTH_COOKIE,
      sealOAuthToken(env.JWT_SECRET, {
        accessToken,
        scope,
        login,
        expiresAt: Date.now() + TOKEN_TTL_MS,
      }),
      oauthCookieOptions(
        env.API_PREFIX,
        env.NODE_ENV === 'production',
        env.GITHUB_OAUTH_COOKIE_SAMESITE,
      ),
    );
    await audit(context, request, 'github.oauth.callback', 'user', verified.userId, {
      organizationId: verified.organizationId,
      login,
    });
    response.redirect(`${env.CLIENT_ORIGIN}/github?oauth=connected`);
  });

  router.use(requireAuth(context));

  router.get('/start', (request, response) => {
    const config = oauthConfig();
    const state = createOAuthState(
      env.JWT_SECRET,
      request.actor!.userId,
      request.actor!.organizationId,
    );
    response.json({ authorizeUrl: buildAuthorizeUrl(config, state), expiresIn: 600 });
  });

  router.get('/status', (request, response) => {
    const sealed = readOAuthCookie(request);
    const session = sealed ? openOAuthToken(env.JWT_SECRET, sealed) : null;
    response.json({
      configured: Boolean(env.GITHUB_OAUTH_CLIENT_ID && env.GITHUB_OAUTH_CLIENT_SECRET && env.GITHUB_OAUTH_REDIRECT_URI),
      connected: Boolean(session),
      expiresIn: session ? Math.max(0, session.expiresAt - Date.now()) : 0,
      ...(session ? { login: session.login, scope: session.scope, expiresAt: session.expiresAt } : {}),
    });
  });

  router.post('/disconnect', async (request, response) => {
    response.clearCookie(GITHUB_OAUTH_COOKIE, { path: env.API_PREFIX });
    await audit(context, request, 'github.oauth.disconnect', 'user', request.actor!.userId);
    response.json({ connected: false });
  });

  return router;
}
