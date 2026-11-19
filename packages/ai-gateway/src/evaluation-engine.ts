import type { GenerationRequest, GenerationResponse } from './types';

export interface EvaluationResult {
  score: number;
  passed: boolean;
  issues: string[];
}

const SECRET_HINT = /(api[_-]?key|password|secret)\s*[:=]\s*['"][^'"]{12,}['"]/i;

export class EvaluationEngine {
  evaluate(response: GenerationResponse, request: GenerationRequest): EvaluationResult {
    const issues: string[] = [];
    const text = response.content.trim();

    if (text.length === 0) issues.push('empty response');
    if (text.length < 20) issues.push('suspiciously short response');
    if (text.includes('[object Object]')) issues.push('serialization artifact in response');
    if (SECRET_HINT.test(text)) issues.push('response appears to contain a credential');
    if (request.taskType === 'security' && !/severity|remediation|risk/i.test(text)) {
      issues.push('security answer lacks severity or remediation guidance');
    }
    if (request.taskType === 'debug' && !/because|root cause|fix/i.test(text)) {
      issues.push('debug answer lacks causal explanation');
    }

    const score = Math.max(0, 100 - issues.length * 20);
    return { score, passed: issues.length === 0, issues };
  }
}
