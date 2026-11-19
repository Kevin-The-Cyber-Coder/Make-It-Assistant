import type { ProjectFile, ReviewFinding, Severity } from '@make-it-ai/shared';

export interface ReviewDraft {
  findings: ReviewFinding[];
  summary: string;
}

function push(
  findings: ReviewFinding[],
  severity: Severity,
  category: ReviewFinding['category'],
  title: string,
  description: string,
  filePath: string,
  line?: number,
  suggestion?: string,
): void {
  findings.push({
    id: crypto.randomUUID(),
    category,
    severity,
    title,
    description,
    filePath,
    line,
    suggestion,
  });
}

export function reviewFiles(files: ProjectFile[]): ReviewDraft {
  const findings: ReviewFinding[] = [];
  const lineMap = new Map<string, Set<string>>();

  for (const file of files) {
    const lines = file.content.split(/\r?\n/);
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (line.length > 160) {
        push(findings, 'low', 'style', 'Long line', `Line exceeds 160 characters (${line.length}).`, file.path, lineNumber, 'Wrap the expression for readability.');
      }
      if (/\bTODO\b|\bFIXME\b|\bHACK\b/.test(line)) {
        push(findings, 'info', 'style', 'Unresolved marker', 'A TODO/FIXME marker remains in the source.', file.path, lineNumber, 'Resolve the marker or link it to a tracked issue.');
      }
      if (/console\.(log|debug)\s*\(/.test(line)) {
        push(findings, 'low', 'style', 'Debug logging', 'Console logging should not remain in production paths.', file.path, lineNumber, 'Replace with a structured logger at an appropriate level.');
      }
      if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(line)) {
        push(findings, 'high', 'bug', 'Swallowed exception', 'An empty catch block hides failures.', file.path, lineNumber, 'Log or rethrow the error with context.');
      }
      if (/\bany\b/.test(line) && /\.(ts|tsx)$/.test(file.path)) {
        push(findings, 'medium', 'style', 'Explicit any type', 'Using any removes type safety.', file.path, lineNumber, 'Use unknown and narrow with validation.');
      }
      const normalized = line.trim().replace(/\s+/g, '');
      if (normalized.length > 40) {
        if (!lineMap.has(normalized)) lineMap.set(normalized, new Set());
        lineMap.get(normalized)!.add(`${file.path}:${lineNumber}`);
      }
    });
  }

  for (const locations of lineMap.values()) {
    if (locations.size > 2) {
      const [first] = [...locations];
      push(findings, 'medium', 'duplication', 'Repeated code', `Identical normalized line appears ${locations.size} times: ${[...locations].slice(0, 4).join(', ')}.`, first.split(':')[0], Number(first.split(':')[1]), 'Extract a shared helper or constant.');
    }
  }

  const bySeverity = findings.reduce<Record<string, number>>((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
    return acc;
  }, {});

  return {
    findings,
    summary: `Reviewed ${files.length} file(s). ${findings.length} finding(s): ${Object.entries(bySeverity).map(([severity, count]) => `${severity} ${count}`).join(', ') || 'none'}.`,
  };
}
