import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import type {
  ProjectFile,
  SandboxExecuteRequest,
  SandboxExecuteResult,
  SandboxStageRequest,
  SandboxStageResult,
} from '@make-it-ai/shared';
import type { WorkerConfig } from './config';

function safePath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!normalized || normalized.includes('..') || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    throw new Error(`Unsafe sandbox path: ${path}`);
  }
  return normalized;
}

function appendBounded(current: string, addition: string, maxBytes: number): string {
  const remaining = maxBytes - Buffer.byteLength(current, 'utf8');
  if (remaining <= 0) return current;
  return current + addition.slice(0, remaining);
}

function buildEnv(config: WorkerConfig): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'NODE_ENV', 'ComSpec']) {
    const value = process.env[key];
    if (value) environment[key] = value;
  }
  const pathKey = process.platform === 'win32' ? 'Path' : 'PATH';
  const existingPath = environment[pathKey] ?? environment.PATH ?? '';
  environment[pathKey] = config.binDir ? `${config.binDir}${delimiter}${existingPath}` : existingPath;
  return environment;
}

async function writeFiles(workspace: string, files: ProjectFile[]): Promise<void> {
  for (const file of files) {
    const relative = safePath(file.path);
    const target = join(workspace, relative);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, 'utf8');
  }
}

export async function executeInSandbox(
  request: SandboxExecuteRequest,
  config: WorkerConfig,
): Promise<SandboxExecuteResult> {
  const started = Date.now();
  if (!request.approved) {
    return { executed: false, exitCode: 403, output: '', durationMs: 0, reason: 'Human approval is required before sandbox execution.' };
  }
  const command = request.command.trim();
  if (!config.allowedCommands.includes(command)) {
    return { executed: false, exitCode: 403, output: '', durationMs: 0, reason: 'Command is not in the sandbox allowlist.' };
  }

  const workspace = await mkdtemp(join(tmpdir(), 'mia-sandbox-'));
  try {
    await writeFiles(workspace, request.files ?? []);
    const parts = command.split(/\s+/).filter(Boolean);
    const executable = process.platform === 'win32' && parts[0] === 'npm' ? 'npm.cmd' : parts[0];
    const args = parts.slice(1);

    const result = await new Promise<{ exitCode: number; output: string }>((resolve) => {
      let output = '';
      const child = spawn(executable, args, {
        cwd: workspace,
        env: buildEnv(config),
        shell: false,
        windowsHide: true,
      });
      const timer = setTimeout(() => child.kill('SIGKILL'), request.timeoutMs ?? config.timeoutMs);
      child.stdout.on('data', (chunk: Buffer) => {
        output = appendBounded(output, chunk.toString('utf8'), config.maxOutputBytes);
      });
      child.stderr.on('data', (chunk: Buffer) => {
        output = appendBounded(output, chunk.toString('utf8'), config.maxOutputBytes);
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        resolve({ exitCode: 1, output: appendBounded(output, error.message, config.maxOutputBytes) });
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ exitCode: code ?? 1, output });
      });
    });

    return { executed: true, ...result, durationMs: Date.now() - started };
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

export async function stageArtifacts(
  request: SandboxStageRequest,
  config: WorkerConfig,
): Promise<SandboxStageResult> {
  const workspace = await mkdtemp(join(tmpdir(), 'mia-stage-'));
  const staged: Array<{ path: string; bytes: number; sha256: string }> = [];
  for (const artifact of request.artifacts ?? []) {
    const relative = safePath(artifact.path);
    const target = join(workspace, relative);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, artifact.content, 'utf8');
    staged.push({
      path: relative,
      bytes: Buffer.byteLength(artifact.content, 'utf8'),
      sha256: createHash('sha256').update(artifact.content).digest('hex'),
    });
  }
  return { staged, applied: false, workspace };
}
