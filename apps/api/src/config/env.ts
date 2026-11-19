import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.string().default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    API_PREFIX: z.string().default('/api/v1'),
    LOG_LEVEL: z.string().default('info'),
    CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
    JWT_SECRET: z.string().min(16).default('dev-only-secret-change-me-please-1234567890'),
    JWT_ACCESS_TTL: z.coerce.number().int().default(900),
    JWT_REFRESH_TTL: z.coerce.number().int().default(1_209_600),
    MONGODB_URI: z.string().default(''),
    MONGODB_DB: z.string().default('make_it_ai'),
    REDIS_URL: z.string().default(''),
    DATA_DIR: z.string().default('.data'),
    OPENAI_API_KEY: z.string().default(''),
    ANTHROPIC_API_KEY: z.string().default(''),
    GEMINI_API_KEY: z.string().default(''),
    OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
    ANTHROPIC_BASE_URL: z.string().default('https://api.anthropic.com/v1'),
    GEMINI_BASE_URL: z.string().default('https://generativelanguage.googleapis.com/v1beta'),
    AI_FALLBACK_ORDER: z.string().default('openai,anthropic,gemini,local-rules'),
    GITHUB_TOKEN: z.string().default(''),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().default(120),
    SANDBOX_URL: z.string().default(''),
    SANDBOX_TOKEN: z.string().default(''),
    SANDBOX_TIMEOUT_MS: z.coerce.number().int().default(120_000),
    SANDBOX_MAX_OUTPUT_BYTES: z.coerce.number().int().default(262_144),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production' && value.JWT_SECRET.length < 32) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be at least 32 characters in production',
      });
    }
  });

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  }
  return result.data;
}
