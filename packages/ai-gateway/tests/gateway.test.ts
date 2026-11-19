import { describe, expect, it, vi } from 'vitest';
import { AIGateway } from '../src/gateway';

describe('AIGateway', () => {
  it('uses the deterministic local adapter when no provider keys are configured', async () => {
    const onUsage = vi.fn();
    const gateway = new AIGateway({ apiKeys: {}, fallbackOrder: ['local-rules'], onUsage });

    const result = await gateway.chat({
      messages: [{ role: 'user', content: 'function total(items) { return items.length }' }],
      taskType: 'explain',
    });

    expect(result.provider).toBe('local-rules');
    expect(result.model).toBe('rule-engine-v1');
    expect(result.content).toContain('OFFLINE RULE-BASED EXPLANATION');
    expect(result.usage.totalTokens).toBeGreaterThan(0);
    expect(onUsage).toHaveBeenCalledOnce();
    expect(onUsage.mock.calls[0][0]).toMatchObject({ provider: 'local-rules', success: true });
  });

  it('exposes provider configuration without revealing credentials', () => {
    const gateway = new AIGateway({ apiKeys: { openai: 'test-key' } });
    const providers = gateway.listProviders();

    expect(providers.map((provider) => provider.id)).toEqual(['openai', 'anthropic', 'gemini', 'local-rules']);
    expect(providers.find((provider) => provider.id === 'openai')?.configured).toBe(true);
    expect(providers.find((provider) => provider.id === 'anthropic')?.configured).toBe(false);
    expect(JSON.stringify(providers)).not.toContain('test-key');
  });

  it('streams incremental chunks and a final marker', async () => {
    const gateway = new AIGateway({ fallbackOrder: ['local-rules'] });
    const chunks = [];
    for await (const chunk of gateway.stream({ messages: [{ role: 'user', content: 'hello' }], taskType: 'general' })) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.at(-1)).toMatchObject({ done: true, provider: 'local-rules' });
    expect(chunks.some((chunk) => chunk.delta.length > 0)).toBe(true);
  });
});
