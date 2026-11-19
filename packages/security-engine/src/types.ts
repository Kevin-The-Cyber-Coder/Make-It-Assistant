import type { Severity } from '@make-it-ai/shared';

export interface FindingDraft {
  severity: Severity;
  category: string;
  title: string;
  description: string;
  filePath?: string;
  line?: number;
  evidence?: string;
  remediation: string;
  references: string[];
}

export function redact(value: string): string {
  return value
    .replace(/((?:api[_-]?key|secret|password|token)["']?\s*[:=]\s*["']?)[^"'\s,}]{6,}/gi, '$1[REDACTED]')
    .replace(/AKIA[0-9A-Z]{16}/g, 'AKIA[REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[JWT REDACTED]')
    .slice(0, 300);
}

export function lineOf(content: string, index: number): number {
  return content.slice(0, index).split(/\r?\n/).length;
}
