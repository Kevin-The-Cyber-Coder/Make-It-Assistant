#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage', '.data', 'tools']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.html', '.yml', '.yaml', '.md', '.example']);

function git(args) {
  try {
    return execFileSync('git', args, { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function walk(directory, files = []) {
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(directory, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full, files);
    else if (stats.isFile()) files.push(full);
  }
  return files;
}

const root = process.cwd();
const tracked = git('ls-files').split('\n').filter(Boolean);
const allFiles = walk(root);
const sourceFiles = allFiles.filter((file) => SOURCE_EXTENSIONS.has(extname(file)) || file.endsWith('.env.example'));
const testFiles = allFiles.filter((file) => /[\\/](tests?|__tests__)[\\/].*\.(test|spec)\.[cm]?[jt]sx?$/.test(file) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(file));
const linesOfCode = sourceFiles.reduce((total, file) => {
  const content = readFileSync(file, 'utf8');
  return total + content.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}, 0);
const workflows = readdirSync(join(root, '.github', 'workflows')).filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'));
const contributors = git(['shortlog', '-sne', 'HEAD']).split('\n').filter(Boolean);
const rootPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const providerFlags = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GITHUB_TOKEN']
  .map((name) => `- ${name}: ${process.env[name] ? 'configured in current environment' : 'not configured in current environment'}`)
  .join('\n');

const report = `# Repository status report

Generated: ${new Date().toISOString()}

This report is generated from the local Git repository and working tree. It states observed facts only; it is not a review approval, security certification, or claim about external systems.

## Git state

- Commit: ${git(['rev-parse', 'HEAD']) || 'unavailable'}
- Branch: ${git(['branch', '--show-current']) || 'detached'}
- Commits reachable from HEAD: ${git(['rev-list', '--count', 'HEAD']) || 'unavailable'}
- Last commit: ${git(['log', '-1', '--format=%h %s (%cI)']) || 'unavailable'}
- Local branches: ${git(['branch', '--format=%(refname:short)']).split('\n').filter(Boolean).join(', ') || 'none'}
- Uncommitted entries: ${git(['status', '--porcelain']).split('\n').filter(Boolean).length}

## Contributors recorded in Git history

${contributors.length ? contributors.map((line) => `- ${line.trim()}`).join('\n') : '- No commit history found'}

## Source inventory

- Tracked files: ${tracked.length}
- Source/config/documentation files scanned (excluding tools, dependencies, builds and local data): ${sourceFiles.length}
- Non-empty lines in scanned files: ${linesOfCode}
- Test files: ${testFiles.length}
- CI workflows: ${workflows.join(', ') || 'none'}

## Platform inventory

- Workspace packages: ${readdirSync(join(root, 'packages')).filter((name) => statSync(join(root, 'packages', name)).isDirectory()).length}
- Applications: ${readdirSync(join(root, 'apps')).filter((name) => statSync(join(root, 'apps', name)).isDirectory()).length}
- Preserved legacy action: ${existsSync(join(root, 'tools', 'changesets-action')) ? 'tools/changesets-action' : 'not found'}
- Root LICENSE file: ${existsSync(join(root, 'LICENSE')) ? 'present' : 'absent'}
- Root package.json license field: ${rootPackage.license ? rootPackage.license : 'absent'}

## Runtime configuration signals (values never included)

${providerFlags}

## Known boundaries

- AI provider calls require server-side keys. Without them the gateway labels responses as offline local-rules output.
- Test execution remains gated behind an approved isolated sandbox worker. Generated test skeletons are not executed tests.
- Dependency findings are offline heuristics, not an authoritative CVE database.
- Redis configuration is present but Redis is not yet wired into runtime behavior.
`;

const outputIndex = process.argv.indexOf('--output');
if (outputIndex !== -1 && process.argv[outputIndex + 1]) {
  const output = process.argv[outputIndex + 1];
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${report}\n`, 'utf8');
  console.log(`Wrote ${relative(root, output)}`);
} else {
  console.log(report);
}
