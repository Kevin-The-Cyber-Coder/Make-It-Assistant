import type { ProjectFile } from '@make-it-ai/shared';

export interface DependencyReport {
  dependencies: Record<string, string>;
  ecosystem: string[];
  manifests: string[];
}

function parsePackageJson(content: string): Record<string, string> {
  try {
    const parsed = JSON.parse(content) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return { ...(parsed.dependencies ?? {}), ...(parsed.devDependencies ?? {}) };
  } catch {
    return {};
  }
}

function parseLines(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-e ') || trimmed.startsWith('git+')) continue;
    const match = trimmed.match(/^([A-Za-z0-9_.\-]+)\s*([<>=!~]=?.*)?$/);
    if (match) result[match[1]] = match[2] ?? '*';
  }
  return result;
}

function parseGoMod(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const match = line.trim().match(/^([^\s]+)\s+v?([\d][^\s]*)/);
    if (match && !match[1].startsWith('//')) result[match[1]] = match[2];
  }
  return result;
}

export function analyzeDependencies(files: ProjectFile[]): DependencyReport {
  const dependencies: Record<string, string> = {};
  const ecosystem = new Set<string>();
  const manifests: string[] = [];

  for (const file of files) {
    const name = file.path.split('/').pop() ?? '';
    if (name === 'package.json') {
      Object.assign(dependencies, parsePackageJson(file.content));
      ecosystem.add('npm');
      manifests.push(file.path);
    } else if (name === 'requirements.txt' || name === 'requirements-dev.txt') {
      Object.assign(dependencies, parseLines(file.content));
      ecosystem.add('python');
      manifests.push(file.path);
    } else if (name === 'go.mod') {
      Object.assign(dependencies, parseGoMod(file.content));
      ecosystem.add('go');
      manifests.push(file.path);
    } else if (name === 'Cargo.toml') {
      Object.assign(dependencies, parseLines(file.content.replace(/\[[^\]]+\]/g, '')));
      ecosystem.add('rust');
      manifests.push(file.path);
    } else if (name === 'composer.json') {
      Object.assign(dependencies, parsePackageJson(file.content));
      ecosystem.add('php');
      manifests.push(file.path);
    } else if (name === 'Gemfile') {
      Object.assign(dependencies, parseLines(file.content.replace(/gem\s+/, '')));
      ecosystem.add('ruby');
      manifests.push(file.path);
    }
  }

  return { dependencies, ecosystem: [...ecosystem], manifests };
}
