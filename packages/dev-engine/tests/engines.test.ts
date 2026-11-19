import { describe, expect, it } from 'vitest';
import type { ProjectFile } from '@make-it-ai/shared';
import { analyzeError } from '../src/debugger';
import { reviewFiles } from '../src/code-review';
import { generateTests } from '../src/test-generator';

const file: ProjectFile = {
  path: 'src/math.ts',
  content: 'export function add(a: number, b: number) { console.log(a + b); return a + b; }',
  language: 'typescript',
  size: 76,
};

describe('developer engines', () => {
  it('reviews source with severity and location', () => {
    const result = reviewFiles([file]);
    expect(result.findings.some((finding) => finding.title === 'Debug logging' && finding.line === 1)).toBe(true);
    expect(result.summary).toContain('Reviewed 1 file(s)');
  });

  it('generates framework-specific skeletons for exported symbols', () => {
    const [generated] = generateTests([file], 'vitest');
    expect(generated.filePath).toBe('src/math.test.ts');
    expect(generated.content).toContain("from 'vitest'");
    expect(generated.content).toContain('handles add smoke case');
  });

  it('classifies a known error signature and parses stack frames', () => {
    const report = analyzeError({
      error: 'TypeError: Cannot read properties of undefined (reading map)',
      stackTrace: 'at renderUsers (/app/src/Users.tsx:42:18)',
    });

    expect(report.language).toBe('typescript');
    expect(report.frames[0]).toMatchObject({ file: '/app/src/Users.tsx', line: 42, column: 18 });
    expect(report.likelyCauses[0]).toContain('null/undefined');
    expect(report.confidence).toBeGreaterThan(0.5);
  });
});
