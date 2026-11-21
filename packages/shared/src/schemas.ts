import { z } from 'zod';

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80),
  password: z.string().min(12).max(128),
  organizationName: z.string().min(2).max(80).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(10) });

export const projectCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).default(''),
  rootPath: z.string().max(500).optional(),
});

export const projectUpdateSchema = projectCreateSchema.partial();

export const conversationCreateSchema = z.object({
  title: z.string().min(1).max(160).default('New conversation'),
  projectId: z.string().optional(),
});

export const conversationUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160),
});

export const chatSchema = z.object({
  conversationId: z.string().optional(),
  projectId: z.string().optional(),
  message: z.string().min(1).max(20000),
  taskType: z
    .enum(['general', 'explain', 'generate', 'security', 'debug', 'documentation', 'architecture'])
    .default('general'),
  provider: z.string().optional(),
  model: z.string().optional(),
  regenerate: z.boolean().default(false),
  context: z.array(z.object({ path: z.string(), content: z.string() })).max(30).optional(),
});

export const taskCreateSchema = z.object({
  objective: z.string().min(10).max(10000),
  projectId: z.string().optional(),
  autoApprove: z.boolean().default(false),
});

export const approvalSchema = z.object({
  stepId: z.string().min(1),
  approved: z.boolean(),
  note: z.string().max(1000).optional(),
});

export const scanSchema = z.object({
  projectId: z.string().optional(),
  files: z
    .array(
      z.object({
        path: z.string().min(1).max(500),
        content: z.string().max(500000),
      }),
    )
    .min(1)
    .max(500),
});

export const reviewSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().min(1).max(200).optional(),
  files: z
    .array(
      z.object({
        path: z.string().min(1).max(500),
        content: z.string().max(500000),
        patch: z.string().max(200000).optional(),
      }),
    )
    .min(1)
    .max(500),
});

export const testRunSchema = z.object({
  projectId: z.string().optional(),
  framework: z.string().min(1).max(50).default('auto'),
  files: z.array(z.object({ path: z.string(), content: z.string() })).max(500).default([]),
  command: z.string().max(500).optional(),
});

export const debugSchema = z.object({
  projectId: z.string().optional(),
  error: z.string().min(1).max(20000),
  stackTrace: z.string().max(50000).optional(),
  files: z.array(z.object({ path: z.string(), content: z.string() })).max(50).optional(),
});

export const githubConnectSchema = z.object({
  owner: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  defaultBranch: z.string().max(200).default('main'),
});

export const indexSchema = z.object({
  projectId: z.string().optional(),
  files: z.array(z.object({ path: z.string(), content: z.string() })).min(1).max(1000),
});
