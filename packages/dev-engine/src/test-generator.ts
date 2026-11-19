import type { ProjectFile } from '@make-it-ai/shared';

export interface GeneratedTest {
  filePath: string;
  content: string;
}

function extractSymbols(file: ProjectFile): string[] {
  const symbols = new Set<string>();
  if (/\.(ts|tsx|js|jsx)$/.test(file.path)) {
    for (const match of file.content.matchAll(/export\s+(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/g)) symbols.add(match[1]);
    for (const match of file.content.matchAll(/export\s+const\s+([A-Za-z_$][\w$]*)\s*=/g)) symbols.add(match[1]);
  } else if (/\.py$/.test(file.path)) {
    for (const match of file.content.matchAll(/^def\s+([A-Za-z_]\w*)\s*\(/gm)) symbols.add(match[1]);
    for (const match of file.content.matchAll(/^class\s+([A-Za-z_]\w*)/gm)) symbols.add(match[1]);
  }
  return [...symbols];
}

function testPathFor(file: ProjectFile): string {
  if (/\.py$/.test(file.path)) return file.path.replace(/\.py$/, '_test.py');
  return file.path.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1');
}

export function generateTests(files: ProjectFile[], framework = 'auto'): GeneratedTest[] {
  const tests: GeneratedTest[] = [];
  for (const file of files) {
    const symbols = extractSymbols(file);
    if (symbols.length === 0) continue;
    const python = /\.py$/.test(file.path);
    const useVitest = !python && (framework === 'auto' || framework === 'vitest');
    const content = python
      ? [
          `# Generated test skeleton for ${file.path}`,
          'import pytest',
          '',
          ...symbols.map((symbol) => [
            `def test_${symbol.toLowerCase()}_smoke():`,
            `    # TODO: arrange inputs for ${symbol}`,
            `    with pytest.raises(NotImplementedError):`,
            `        raise NotImplementedError("Implement ${symbol} test")`,
            '',
          ].join('\n')),
        ].join('\n')
      : [
          `// Generated test skeleton for ${file.path}`,
          `import { describe, it, expect } from '${useVitest ? 'vitest' : '@jest/globals'}'`,
          '',
          `describe('${file.path}', () => {`,
          ...symbols.map((symbol) => [
            `  it('handles ${symbol} smoke case', () => {`,
            `    // TODO: arrange inputs and assert observable behaviour for ${symbol}`,
            `    expect(typeof ${symbol}).toBe('function')`,
            '  })',
          ].join('\n')),
          '})',
          '',
        ].join('\n');

    tests.push({ filePath: testPathFor(file), content });
  }
  return tests;
}
