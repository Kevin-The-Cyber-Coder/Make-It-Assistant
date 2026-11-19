import { describe, expect, it } from 'vitest';
import { riskLevel, scanSource } from '../src/scanner';
import type { ProjectFile } from '@make-it-ai/shared';

function file(path: string, content: string): ProjectFile {
  return { path, content, language: 'typescript', size: content.length };
}

describe('security scanner', () => {
  it('detects secrets, injection sinks and inline database credentials', () => {
    const scan = scanSource('org_test', [file('src/config.ts', [
      'const awsKey = "AKIA1234567890ABCDEF";',
      'eval(process.env.INPUT);',
      'const url = "mongodb://admin:password123@db:27017/app";',
    ].join('\n'))]);

    expect(scan.filesScanned).toBe(1);
    expect(scan.summary.critical).toBeGreaterThanOrEqual(3);
    expect(riskLevel(scan)).toBe('critical');
    expect(scan.findings.some((finding) => finding.category === 'secret-exposure')).toBe(true);
    expect(scan.findings.some((finding) => finding.category === 'sast:JS-EVAL')).toBe(true);
    expect(scan.findings.every((finding) => finding.organizationId === 'org_test')).toBe(true);
  });

  it('reports a clean risk level for benign source', () => {
    const scan = scanSource('org_test', [file('src/math.ts', 'export function add(a: number, b: number) { return a + b; }')]);
    expect(scan.findings.every((finding) => finding.severity === 'info')).toBe(true);
    expect(riskLevel(scan)).toBe('clean');
  });

  it('redacts evidence so scan results do not repeat full secrets', () => {
    const secret = 'AKIA1234567890ABCDEF';
    const scan = scanSource('org_test', [file('src/config.ts', `const key = "${secret}";`)]);
    expect(JSON.stringify(scan)).not.toContain(secret);
  });
});
