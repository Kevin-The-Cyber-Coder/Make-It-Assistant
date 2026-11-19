export interface WorkerConfig {
  port: number;
  token: string;
  allowedCommands: string[];
  timeoutMs: number;
  maxOutputBytes: number;
  binDir: string;
}

const DEFAULT_COMMANDS = [
  'node --version',
  'npm --version',
  'npm test',
  'npm run typecheck',
  'npm run build',
  'vitest run',
];

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadWorkerConfig(source: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const rawCommands = source.SANDBOX_ALLOWED_COMMANDS ?? '';
  const allowedCommands = rawCommands
    .split(',')
    .map((command) => command.trim())
    .filter(Boolean);

  return {
    port: positiveInt(source.WORKER_PORT, 4100),
    token: source.SANDBOX_TOKEN ?? '',
    allowedCommands: allowedCommands.length ? allowedCommands : DEFAULT_COMMANDS,
    timeoutMs: positiveInt(source.SANDBOX_TIMEOUT_MS, 120_000),
    maxOutputBytes: positiveInt(source.SANDBOX_MAX_OUTPUT_BYTES, 262_144),
    binDir: source.SANDBOX_BIN_DIR ?? '',
  };
}
