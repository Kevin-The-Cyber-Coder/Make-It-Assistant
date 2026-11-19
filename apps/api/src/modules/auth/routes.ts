import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { AppError, loginSchema, refreshSchema, registerSchema } from '@make-it-ai/shared';
import type { Role, User } from '@make-it-ai/shared';
import type { AppContext } from '../../context';
import { audit } from '../../lib/audit';
import { hashPassword, hashToken, randomToken, signToken, verifyPassword, verifyToken } from '../../lib/crypto';
import { requireAuth, validate } from '../../middleware';

interface RefreshEntry {
  userId: string;
  organizationId: string;
  expiresAt: number;
}

const refreshTokens = new Map<string, RefreshEntry>();

function publicUser(user: User) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

export function createAuthRouter(context: AppContext): Router {
  const router = Router();

  function issueTokens(user: User, organizationId: string) {
    const accessToken = signToken(
      { sub: user.id, org: organizationId, type: 'access' },
      context.env.JWT_SECRET,
      context.env.JWT_ACCESS_TTL,
    );
    const refreshToken = signToken(
      { sub: user.id, org: organizationId, type: 'refresh', jti: randomToken(16) },
      context.env.JWT_SECRET,
      context.env.JWT_REFRESH_TTL,
    );
    refreshTokens.set(hashToken(refreshToken), {
      userId: user.id,
      organizationId,
      expiresAt: Date.now() + context.env.JWT_REFRESH_TTL * 1000,
    });
    return { accessToken, refreshToken, expiresIn: context.env.JWT_ACCESS_TTL };
  }

  router.post('/register', validate(registerSchema), async (request, response) => {
    const input = request.body as ReturnType<typeof registerSchema.parse>;
    const existing = await context.db.repositories.users.findOne({ where: { email: input.email.toLowerCase() } });
    if (existing) throw new AppError('CONFLICT', 'An account with that email already exists');

    const organizationId = `org_${randomUUID()}`;
    const now = new Date().toISOString();
    await context.db.repositories.organizations.create({
      id: organizationId,
      name: input.organizationName ?? `${input.name}'s workspace`,
      slug: `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'}-${organizationId.slice(-6)}`,
      createdAt: now,
    });
    const user: User = {
      id: `usr_${randomUUID()}`,
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash: hashPassword(input.password),
      organizationRoles: { [organizationId]: 'owner' as Role },
      createdAt: now,
    };
    await context.db.repositories.users.create(user);
    await audit(context, request, 'auth.register', 'user', user.id);
    response.status(201).json({ user: publicUser(user), tokens: issueTokens(user, organizationId) });
  });

  router.post('/login', validate(loginSchema), async (request, response) => {
    const input = request.body as ReturnType<typeof loginSchema.parse>;
    const user = await context.db.repositories.users.findOne({ where: { email: input.email.toLowerCase() } });
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new AppError('UNAUTHORIZED', 'Invalid email or password');
    }
    const organizationId = Object.keys(user.organizationRoles)[0];
    if (!organizationId) throw new AppError('FORBIDDEN', 'User has no organization');
    await audit(context, request, 'auth.login', 'user', user.id);
    response.json({ user: publicUser(user), tokens: issueTokens(user, organizationId) });
  });

  router.post('/refresh', validate(refreshSchema), (request, response) => {
    const { refreshToken } = request.body as ReturnType<typeof refreshSchema.parse>;
    const key = hashToken(refreshToken);
    const stored = refreshTokens.get(key);
    const payload = verifyToken(refreshToken, context.env.JWT_SECRET);
    if (!stored || !payload || payload.type !== 'refresh' || stored.expiresAt < Date.now()) {
      refreshTokens.delete(key);
      throw new AppError('UNAUTHORIZED', 'Invalid or expired refresh token');
    }
    refreshTokens.delete(key);
    const user = payload.sub;
    const fakeUser = { id: user } as User;
    response.json({ tokens: issueTokens(fakeUser, stored.organizationId) });
  });

  router.post('/logout', validate(refreshSchema), (request, response) => {
    const { refreshToken } = request.body as ReturnType<typeof refreshSchema.parse>;
    refreshTokens.delete(hashToken(refreshToken));
    response.json({ success: true });
  });

  router.get('/me', requireAuth(context), async (request, response) => {
    const user = await context.db.repositories.users.findById(request.actor!.userId);
    if (!user) throw new AppError('NOT_FOUND', 'User not found');
    response.json({ user: publicUser(user), actor: request.actor });
  });

  return router;
}
