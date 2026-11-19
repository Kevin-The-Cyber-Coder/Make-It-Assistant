import { describe, expect, it } from 'vitest';
import { chatSchema, registerSchema, scanSchema } from '../src/schemas';

describe('shared request schemas', () => {
  it('accepts a valid registration and lower-level constraints are enforced', () => {
    expect(registerSchema.parse({ email: 'ada@example.com', name: 'Ada', password: 'a-very-long-password' })).toMatchObject({ email: 'ada@example.com', name: 'Ada' });
    expect(registerSchema.safeParse({ email: 'not-an-email', name: 'A', password: 'short' }).success).toBe(false);
  });

  it('applies chat defaults and rejects empty prompts', () => {
    const parsed = chatSchema.parse({ message: 'Explain this module' });
    expect(parsed.taskType).toBe('general');
    expect(parsed.regenerate).toBe(false);
    expect(chatSchema.safeParse({ message: '' }).success).toBe(false);
  });

  it('requires at least one scan file', () => {
    expect(scanSchema.safeParse({ files: [] }).success).toBe(false);
    expect(scanSchema.safeParse({ files: [{ path: 'src/app.ts', content: 'const ok = true;' }] }).success).toBe(true);
  });
});
