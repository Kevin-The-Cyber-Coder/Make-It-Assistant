import { Router, type Request } from 'express';
import { randomUUID } from 'node:crypto';
import { StreamUsageTracker } from '@make-it-ai/ai-gateway';
import {
  AppError,
  chatSchema,
  type ChatMessage,
  type Conversation,
  type Message,
  type ProjectFile,
} from '@make-it-ai/shared';
import type { AppContext } from '../../context';
import { audit } from '../../lib/audit';
import { requireAuth, validate } from '../../middleware';

type ChatInput = ReturnType<typeof chatSchema.parse>;

async function ensureConversation(context: AppContext, request: Request, input: ChatInput): Promise<Conversation> {
  const repositories = context.db.repositories;
  if (input.conversationId) {
    const conversation = await repositories.conversations.findById(input.conversationId);
    if (!conversation || conversation.organizationId !== request.actor!.organizationId) {
      throw new AppError('NOT_FOUND', 'Conversation not found');
    }
    return conversation;
  }
  const now = new Date().toISOString();
  const conversation: Conversation = {
    id: `cnv_${randomUUID()}`,
    organizationId: request.actor!.organizationId,
    userId: request.actor!.userId,
    projectId: input.projectId,
    title: input.message.slice(0, 80),
    createdAt: now,
    updatedAt: now,
  };
  await repositories.conversations.create(conversation);
  return conversation;
}

function contextFiles(context: AppContext, input: ChatInput): ProjectFile[] {
  const indexed = input.projectId ? context.indexes.get(input.projectId)?.files ?? [] : [];
  const supplied = (input.context ?? []).map((file) => ({
    path: file.path,
    content: file.content,
    language: 'text',
    size: file.content.length,
  }));
  return [...indexed, ...supplied].slice(0, 30);
}

async function buildMessages(context: AppContext, conversation: Conversation, input: ChatInput): Promise<ChatMessage[]> {
  const history = await context.db.repositories.messages.find({
    where: { organizationId: conversation.organizationId, conversationId: conversation.id },
    sort: { field: 'createdAt', direction: 'asc' },
    limit: 40,
  });
  const withoutLastAnswer = input.regenerate ? history.filter((message, index) => index !== history.length - 1) : history;
  const messages: ChatMessage[] = withoutLastAnswer
    .filter((message) => message.role !== 'system')
    .map((message) => ({ role: message.role as ChatMessage['role'], content: message.content }));
  if (!input.regenerate) messages.push({ role: 'user', content: input.message });
  return messages.slice(-20);
}

async function persistMessage(
  context: AppContext,
  conversation: Conversation,
  role: Message['role'],
  content: string,
  metadata: Partial<Message> = {},
): Promise<void> {
  const message: Message = {
    id: `msg_${randomUUID()}`,
    organizationId: conversation.organizationId,
    conversationId: conversation.id,
    role,
    content,
    createdAt: new Date().toISOString(),
    ...metadata,
  };
  await context.db.repositories.messages.create(message);
  await context.db.repositories.conversations.update(conversation.id, { updatedAt: message.createdAt });
}

export function createAIRouter(context: AppContext): Router {
  const router = Router();
  router.use(requireAuth(context));

  router.get('/providers', (_request, response) => {
    response.json({
      providers: context.gateway.listProviders().map((provider) => ({
        ...provider,
        models: provider.models.map((model) => ({ id: model.id, displayName: model.displayName, capabilities: model.capabilities })),
      })),
    });
  });

  router.get('/models', (_request, response) => {
    response.json({ models: context.gateway.listModels() });
  });

  router.post('/enhance', (request, response) => {
    const message = String(request.body?.message ?? '').trim();
    if (!message) throw new AppError('BAD_REQUEST', 'message is required');
    const enhanced = [
      message,
      '',
      'Constraints:',
      '- Be concrete and reference exact files, functions and commands.',
      '- Include error handling and tests for every change.',
      '- State assumptions explicitly and avoid unverified claims.',
      '- For security work, remain defensive and permission-based.',
    ].join('\n');
    response.json({ enhanced });
  });

  router.post('/chat', validate(chatSchema), async (request, response) => {
    const input = request.body as ChatInput;
    const conversation = await ensureConversation(context, request, input);
    const messages = await buildMessages(context, conversation, input);
    const result = await context.gateway.chat({
      messages,
      taskType: input.taskType,
      provider: input.provider as never,
      model: input.model,
      context: contextFiles(context, input),
      metadata: { organizationId: request.actor!.organizationId, userId: request.actor!.userId },
    });

    if (!input.regenerate) {
      await persistMessage(context, conversation, 'user', input.message);
    }
    await persistMessage(context, conversation, 'assistant', result.content, {
      provider: result.provider,
      model: result.model,
      tokens: result.usage.totalTokens,
    });
    await audit(context, request, 'ai.chat', 'conversation', conversation.id, {
      provider: result.provider,
      model: result.model,
      taskType: input.taskType,
    });

    response.json({
      conversationId: conversation.id,
      message: result.content,
      provider: result.provider,
      model: result.model,
      usage: result.usage,
      evaluation: result.evaluation,
      codeBlocks: result.normalized.codeBlocks,
    });
  });

  router.post('/stream', validate(chatSchema), async (request, response) => {
    const input = request.body as ChatInput;
    const conversation = await ensureConversation(context, request, input);
    const messages = await buildMessages(context, conversation, input);

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();

    let full = '';
    let lastProvider = 'local-rules';
    let lastModel = 'rule-engine-v1';
    const usageTracker = new StreamUsageTracker({
      organizationId: request.actor!.organizationId,
      userId: request.actor!.userId,
    });
    const promptChars = JSON.stringify(messages).length;
    try {
      for await (const chunk of context.gateway.stream({
        messages,
        taskType: input.taskType,
        provider: input.provider as never,
        model: input.model,
        context: contextFiles(context, input),
        metadata: { organizationId: request.actor!.organizationId, userId: request.actor!.userId },
      })) {
        full += chunk.delta;
        lastProvider = chunk.provider;
        lastModel = chunk.model;
        usageTracker.observe(chunk);
        response.write(`event: chunk\ndata: ${JSON.stringify(chunk)}\n\n`);
      }
      const usage = usageTracker.summary(promptChars, true);
      await persistMessage(context, conversation, 'user', input.message);
      await persistMessage(context, conversation, 'assistant', full, {
        provider: lastProvider,
        model: lastModel,
        tokens: usage.totalTokens,
      });
      await audit(context, request, 'ai.stream', 'conversation', conversation.id, {
        provider: usage.provider,
        model: usage.model,
        totalTokens: usage.totalTokens,
        estimated: usage.estimated,
      });
      response.write(`event: usage\ndata: ${JSON.stringify(usage)}\n\n`);
      response.write(`event: done\ndata: ${JSON.stringify({ conversationId: conversation.id, provider: lastProvider, model: lastModel, usage })}\n\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      response.write(`event: usage\ndata: ${JSON.stringify(usageTracker.summary(promptChars, false))}\n\n`);
      response.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
    }
    response.end();
  });

  return router;
}
