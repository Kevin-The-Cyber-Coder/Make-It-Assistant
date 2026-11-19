import type { ProjectFile, ProjectIndex } from '@make-it-ai/shared';
import { searchProject } from './indexer';

export function retrieveContext(index: ProjectIndex, query: string, maxFiles = 8, maxChars = 40_000): ProjectFile[] {
  const candidates = searchProject(index, query, maxFiles * 2);
  const selected: ProjectFile[] = [];
  let used = 0;
  for (const file of candidates) {
    const size = file.content.length;
    if (used + size > maxChars) {
      selected.push({ ...file, content: file.content.slice(0, Math.max(0, maxChars - used)) });
      used = maxChars;
    } else {
      selected.push(file);
      used += size;
    }
    if (selected.length >= maxFiles || used >= maxChars) break;
  }
  return selected;
}

export function summarizeProject(index: ProjectIndex): string {
  return [
    `Project ${index.projectId}: ${index.files.length} files, ${index.languages.join(', ') || 'unknown languages'}.`,
    index.frameworks.length ? `Frameworks: ${index.frameworks.join(', ')}.` : 'No known frameworks detected.',
    index.entryPoints.length ? `Entry points: ${index.entryPoints.join(', ')}.` : 'No standard entry point detected.',
    `Tracked dependencies: ${Object.keys(index.dependencies).length}.`,
  ].join('\n');
}
