import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { AppError, conversationCreateSchema, conversationUpdateSchema, paginationSchema } from '@make-it-ai/shared';
import type { Conversation } from '@make-it-ai/shared';
import type { AppContext } from '../../context';
import { audit } from '../../lib/audit';
import { requireAuth, validate } from '../../middleware';

export function createConversationRouter(context: AppContext): Router {
  const router = Router();
  router.use(requireAuth(context));

  router.get('/', async (request, response) => {
    const query = paginationSchema.parse(request.query);
    const conversations = await context.db.repositories.conversations.find({
      where: { organizationId: request.actor!.organizationId },
      sort: { field: 'updatedAt', direction: 'desc' },
      limit: query.limit,
      offset: query.offset,
    });
    response.json({ conversations });
  });

  router.get('/metrics', async (request, response) => {
    const organizationId = request.actor!.organizationId;
    const [conversations, messages] = await Promise.all([
      context.db.repositories.conversations.find({ where: { organizationId }, limit: 2000 }),
      context.db.repositories.messages.find({ where: { organizationId }, limit: 5000 }),
    ]);
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const activeLast24h = conversations.filter((conversation) => Date.parse(conversation.updatedAt) >= dayAgo).length;
    response.json({
      metrics: {
        totalConversations: conversations.length,
        totalMessages: messages.length,
        activeLast24h,
        avgMessagesPerConversation: conversations.length ? Number((messages.length / conversations.length).toFixed(1)) : 0,
      },
    });
  });

  router.post('/', validate(conversationCreateSchema), async (request, response) => {
    const input = request.body as ReturnType<typeof conversationCreateSchema.parse>;
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: `cnv_${randomUUID()}`,
      organizationId: request.actor!.organizationId,
      userId: request.actor!.userId,
      projectId: input.projectId,
      title: input.title,
      createdAt: now,
      updatedAt: now,
    };
    await context.db.repositories.conversations.create(conversation);
    response.status(201).json({ conversation });
  });

  router.get('/:id', async (request, response) => {
    const conversation = await context.db.repositories.conversations.findById(request.params.id);
    if (!conversation || conversation.organizationId !== request.actor!.organizationId) {
      throw new AppError('NOT_FOUND', 'Conversation not found');
    }
    response.json({ conversation });
  });

  router.patch('/:id', validate(conversationUpdateSchema), async (request, response) => {
    const conversation = await context.db.repositories.conversations.findById(request.params.id);
    if (!conversation || conversation.organizationId !== request.actor!.organizationId) {
      throw new AppError('NOT_FOUND', 'Conversation not found');
    }
    const input = request.body as ReturnType<typeof conversationUpdateSchema.parse>;
    const updated = await context.db.repositories.conversations.update(conversation.id, {
      title: input.title,
      updatedAt: new Date().toISOString(),
    });
    await audit(context, request, 'conversation.update', 'conversation', conversation.id, { title: input.title });
    response.json({ conversation: updated ?? { ...conversation, title: input.title, updatedAt: new Date().toISOString() } });
  });

  router.get('/:id/messages', async (request, response) => {
    const conversation = await context.db.repositories.conversations.findById(request.params.id);
    if (!conversation || conversation.organizationId !== request.actor!.organizationId) {
      throw new AppError('NOT_FOUND', 'Conversation not found');
    }
    const messages = await context.db.repositories.messages.find({
      where: { organizationId: request.actor!.organizationId, conversationId: conversation.id },
      sort: { field: 'createdAt', direction: 'asc' },
      limit: 500,
    });
    response.json({ conversation, messages });
  });

  router.get('/:id/export', async (request, response) => {
    const conversation = await context.db.repositories.conversations.findById(request.params.id);
    if (!conversation || conversation.organizationId !== request.actor!.organizationId) {
      throw new AppError('NOT_FOUND', 'Conversation not found');
    }
    const messages = await context.db.repositories.messages.find({
      where: { organizationId: request.actor!.organizationId, conversationId: conversation.id },
      sort: { field: 'createdAt', direction: 'asc' },
      limit: 5000,
    });
    await audit(context, request, 'conversation.export', 'conversation', conversation.id, { messageCount: messages.length });
    response.setHeader('Content-Disposition', `attachment; filename="conversation-${conversation.id}.json"`);
    response.json({ conversation, messages, exportedAt: new Date().toISOString() });
  });

  router.delete('/:id', async (request, response) => {
    const conversation = await context.db.repositories.conversations.findById(request.params.id);
    if (!conversation || conversation.organizationId !== request.actor!.organizationId) {
      throw new AppError('NOT_FOUND', 'Conversation not found');
    }
    await context.db.repositories.conversations.delete(conversation.id);
    response.json({ success: true });
  });

  return router;
}
