import { CapabilityRegistry } from '../capability-registry';
import type { GenerationRequest, GenerationResponse, ProviderAdapter, StreamChunk } from '../types';

const capabilities = new CapabilityRegistry();

const SECRET_PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /(api[_-]?key|secret|token)\s*[:=]\s*["'][^"']{12,}["']/i,
];

function lastUserMessage(request: GenerationRequest): string {
  return [...request.messages].reverse().find((message) => message.role === 'user')?.content ?? '';
}

function offlineAnswer(request: GenerationRequest): string {
  const input = lastUserMessage(request);
  switch (request.taskType) {
    case 'security': {
      const hits = SECRET_PATTERNS.filter((pattern) => pattern.test(input)).length;
      return [
        'OFFLINE RULE-BASED ANALYSIS (no external AI provider configured).',
        `Scanned ${input.length} characters of supplied content.`,
        hits > 0 ? `Detected ${hits} potential secret pattern class(es). Rotate and remove exposed credentials.` : 'No obvious secret patterns detected in the supplied text.',
        'Review: input validation, authorization checks, dependency versions, and insecure configuration.',
        'This is heuristic guidance only. Configure an AI provider for deeper analysis.',
      ].join('\n');
    }
    case 'debug': {
      const frames = input.split(/\r?\n/).filter((line) => /\bat\s+\S+|\.ts:\d+|\.js:\d+|Error:/i.test(line)).slice(0, 8);
      return [
        'OFFLINE RULE-BASED DIAGNOSIS.',
        `Error summary: ${input.split(/\r?\n/)[0].slice(0, 240)}`,
        frames.length ? `Relevant frames:\n${frames.map((frame) => `  - ${frame.trim()}`).join('\n')}` : 'No stack frames detected. Provide a full stack trace for better diagnosis.',
        'Next steps: reproduce minimally, inspect the first application frame, check null/undefined access and async boundaries.',
      ].join('\n');
    }
    case 'explain':
    case 'general': {
      const functions = [...input.matchAll(/\b(?:function|class|interface|def|fn)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]);
      return [
        'OFFLINE RULE-BASED EXPLANATION.',
        `Input size: ${input.length} characters.`,
        functions.length ? `Declared symbols: ${functions.slice(0, 12).join(', ')}.` : 'No top-level declarations detected in the supplied snippet.',
        'This adapter is deterministic and does not contact an external model. Configure OPENAI_API_KEY, ANTHROPIC_API_KEY or GEMINI_API_KEY for full analysis.',
      ].join('\n');
    }
    case 'generate':
      return [
        'OFFLINE SCAFFOLD GUIDANCE.',
        '1. Define the domain types and validation schemas first.',
        '2. Implement a service layer with explicit interfaces and error types.',
        '3. Expose versioned HTTP routes and validate every request.',
        '4. Add unit tests for services and integration tests for routes.',
        '5. Document environment variables and runbooks.',
      ].join('\n');
    case 'documentation':
      return [
        '# Offline documentation outline',
        '## Overview\n## Features\n## Architecture\n## Installation\n## Configuration\n## Usage\n## Testing\n## Deployment\n## Security\n## Contributing',
      ].join('\n');
    case 'architecture':
      return [
        'OFFLINE ARCHITECTURE SUGGESTION.',
        'Presentation layer -> API gateway -> Domain services -> Repository interfaces -> Data stores.',
        'Keep cross-cutting concerns (auth, validation, audit, rate limits) in middleware.',
        'Use background workers for long-running agent tasks and code execution.',
        'Isolate untrusted repository content and sandbox all command execution.',
      ].join('\n');
    default:
      return 'Offline rule engine response. Configure an AI provider for model-backed answers.';
  }
}

export class LocalRulesAdapter implements ProviderAdapter {
  readonly id = 'local-rules' as const;

  listModels() {
    return capabilities.list('local-rules');
  }

  async generate(request: GenerationRequest): Promise<GenerationResponse> {
    const started = Date.now();
    const content = offlineAnswer(request);
    return {
      content,
      provider: this.id,
      model: 'rule-engine-v1',
      usage: {
        promptTokens: Math.ceil(JSON.stringify(request.messages).length / 4),
        completionTokens: Math.ceil(content.length / 4),
        totalTokens: Math.ceil((JSON.stringify(request.messages).length + content.length) / 4),
      },
      latencyMs: Date.now() - started,
      finishReason: 'stop',
    };
  }

  async *stream(request: GenerationRequest): AsyncGenerator<StreamChunk> {
    const content = offlineAnswer(request);
    const words = content.split(/(\s+)/);
    for (let index = 0; index < words.length; index += 6) {
      yield {
        delta: words.slice(index, index + 6).join(''),
        provider: this.id,
        model: 'rule-engine-v1',
        done: false,
      };
    }
    yield { delta: '', provider: this.id, model: 'rule-engine-v1', done: true };
  }
}
