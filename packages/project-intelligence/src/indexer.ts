import type { ProjectIndex, ProjectFile } from '@make-it-ai/shared';
import { analyzeDependencies } from './dependency-analyzer';
import { detectLanguage, isIgnored, scanFiles } from './scanner';

const FRAMEWORK_SIGNATURES: Array<[string, string]> = [
  ['react', 'React'], ['next', 'Next.js'], ['vue', 'Vue'], ['angular', 'Angular'],
  ['express', 'Express'], ['nestjs', 'NestJS'], ['fastify', 'Fastify'],
  ['django', 'Django'], ['flask', 'Flask'], ['fastapi', 'FastAPI'],
  ['spring', 'Spring'], ['rails', 'Rails'], ['laravel', 'Laravel'],
  ['tokio', 'Tokio'], ['gin', 'Gin'],
];

const ENTRY_POINTS = [
  'src/index.ts', 'src/index.tsx', 'src/main.ts', 'src/main.tsx', 'src/server.ts',
  'index.js', 'app.py', 'main.py', 'main.go', 'cmd/main.go', 'main.rs', 'Program.cs', 'index.php',
];

export function indexProject(projectId: string, files: ProjectFile[]): ProjectIndex {
  const clean = files.filter((file) => !isIgnored(file.path)).map((file) => ({
    ...file,
    language: file.language || detectLanguage(file.path),
    size: file.content.length,
  }));
  const stats = scanFiles(clean);
  const dependencies = analyzeDependencies(clean).dependencies;
  const frameworks = FRAMEWORK_SIGNATURES.filter(([pkg]) => dependencies[pkg]).map(([, name]) => name);
  const paths = new Set(clean.map((file) => file.path));
  const entryPoints = ENTRY_POINTS.filter((path) => paths.has(path));

  return {
    projectId,
    files: clean,
    languages: Object.keys(stats.languages),
    frameworks,
    entryPoints,
    dependencies,
    indexedAt: new Date().toISOString(),
  };
}

export function buildSearchIndex(index: ProjectIndex): Map<string, Set<string>> {
  const inverted = new Map<string, Set<string>>();
  for (const file of index.files) {
    const tokens = `${file.path}\n${file.content.slice(0, 20_000)}`
      .toLowerCase()
      .split(/[^a-z0-9_$]+/)
      .filter((token) => token.length > 2);
    const unique = new Set(tokens);
    for (const token of unique) {
      if (!inverted.has(token)) inverted.set(token, new Set());
      inverted.get(token)!.add(file.path);
    }
  }
  return inverted;
}

export function searchProject(index: ProjectIndex, query: string, limit = 20): ProjectFile[] {
  const inverted = buildSearchIndex(index);
  const terms = query.toLowerCase().split(/[^a-z0-9_$]+/).filter((term) => term.length > 2);
  const scores = new Map<string, number>();
  for (const term of terms) {
    for (const path of inverted.get(term) ?? []) {
      scores.set(path, (scores.get(path) ?? 0) + 1);
      if (path.toLowerCase().includes(term)) scores.set(path, (scores.get(path) ?? 0) + 2);
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([path]) => index.files.find((file) => file.path === path)!)
    .filter(Boolean);
}
