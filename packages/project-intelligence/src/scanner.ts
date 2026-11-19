import type { ProjectFile } from '@make-it-ai/shared';

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  py: 'python', java: 'java', c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cs: 'csharp', php: 'php', rb: 'ruby',
  go: 'go', rs: 'rust', swift: 'swift', kt: 'kotlin', kts: 'kotlin', dart: 'dart', sql: 'sql',
  html: 'html', css: 'css', scss: 'css', json: 'json', yml: 'yaml', yaml: 'yaml', md: 'markdown',
  sh: 'shell', ps1: 'powershell', dockerfile: 'dockerfile',
};

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  language?: string;
  children?: TreeNode[];
}

export interface ScanResult {
  fileCount: number;
  lineCount: number;
  byteCount: number;
  languages: Record<string, number>;
  ignored: string[];
  tree: TreeNode[];
}

export function detectLanguage(filePath: string): string {
  const base = filePath.split('/').pop()?.toLowerCase() ?? '';
  if (base === 'dockerfile') return 'dockerfile';
  const extension = base.includes('.') ? base.split('.').pop() ?? '' : '';
  return LANGUAGE_BY_EXTENSION[extension] ?? 'unknown';
}

export function isIgnored(filePath: string): boolean {
  const segments = filePath.split('/');
  const ignoredDirs = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.cache', 'vendor', '__pycache__']);
  return segments.some((segment) => ignoredDirs.has(segment)) || /\.(lock|min\.js|map)$/.test(filePath);
}

export function buildTree(files: ProjectFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const file of files) {
    const segments = file.path.split('/').filter(Boolean);
    let level = root;
    let currentPath = '';
    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const isFile = index === segments.length - 1;
      let node = level.find((candidate) => candidate.name === segment && candidate.type === (isFile ? 'file' : 'directory'));
      if (!node) {
        node = {
          name: segment,
          path: currentPath,
          type: isFile ? 'file' : 'directory',
          ...(isFile ? { language: file.language } : { children: [] as TreeNode[] }),
        };
        level.push(node);
      }
      if (!isFile && node.children) level = node.children;
    });
  }
  return root.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1));
}

export function scanFiles(files: ProjectFile[]): ScanResult {
  const accepted = files.filter((file) => !isIgnored(file.path));
  const languages: Record<string, number> = {};
  let lineCount = 0;
  let byteCount = 0;
  for (const file of accepted) {
    languages[file.language] = (languages[file.language] ?? 0) + 1;
    lineCount += file.content.split(/\r?\n/).length;
    byteCount += file.content.length;
  }
  return {
    fileCount: accepted.length,
    lineCount,
    byteCount,
    languages,
    ignored: files.filter((file) => isIgnored(file.path)).map((file) => file.path),
    tree: buildTree(accepted),
  };
}
