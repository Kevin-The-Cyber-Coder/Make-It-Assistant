export interface StackFrame {
  file: string;
  line?: number;
  column?: number;
  fn?: string;
}

export interface DebugReport {
  summary: string;
  language: string;
  frames: StackFrame[];
  likelyCauses: string[];
  suggestedFixes: string[];
  confidence: number;
}

const KNOWN_ERRORS: Array<{ pattern: RegExp; cause: string; fix: string }> = [
  { pattern: /cannot read propert(y|ies).*of (undefined|null)|is not a function/i, cause: 'A value is null/undefined at access time, often from an unawaited promise or missing guard.', fix: 'Add optional chaining and a null check, then verify the async call is awaited.' },
  { pattern: /cannot find module|module not found|importerror|modulenotfounderror/i, cause: 'A dependency is missing or the import path/casing is wrong.', fix: 'Install the dependency, correct the import path, and check case sensitivity on Linux-based CI.' },
  { pattern: /econnrefused|connection refused/i, cause: 'The target service is not listening or the host/port is wrong.', fix: 'Verify the service is running, check the port, and confirm network/container configuration.' },
  { pattern: /enotfound|getaddrinfo/i, cause: 'DNS resolution failed for the configured hostname.', fix: 'Check the hostname, proxy and DNS settings.' },
  { pattern: /syntaxerror|unexpected token/i, cause: 'The parser encountered invalid syntax, often an unclosed delimiter or wrong file type.', fix: 'Inspect the reported line, check matching braces/quotes, and confirm the loader supports the syntax.' },
  { pattern: /unique constraint|duplicate key|e11000/i, cause: 'A write violates a uniqueness constraint.', fix: 'Check for existing records and handle conflicts with an upsert or explicit validation.' },
  { pattern: /timeout|etimedout/i, cause: 'An operation exceeded its configured deadline.', fix: 'Increase the timeout deliberately, add retries with backoff, and investigate slow dependencies.' },
  { pattern: /jwt|token expired|invalid signature/i, cause: 'Authentication token validation failed.', fix: 'Refresh the token, verify clock skew and confirm the signing algorithm and secret.' },
  { pattern: /permission denied|eacces|forbidden/i, cause: 'The process lacks permission for the requested resource.', fix: 'Use least-privilege credentials with the correct scopes rather than disabling checks.' },
];

function parseFrames(text: string): StackFrame[] {
  const frames: StackFrame[] = [];
  const patterns = [
    /at\s+(?:(.+?)\s+\()?((?:[A-Za-z]:)?[^\s()]+):(\d+):(\d+)\)?/g,
    /File\s+"([^"]+)",\s+line\s+(\d+)/g,
    /at\s+(\S+)\s+\((\S+):(\d+):(\d+)\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (pattern === patterns[1]) {
        frames.push({ file: match[1], line: Number(match[2]) });
      } else if (pattern === patterns[2]) {
        frames.push({ fn: match[1], file: match[2], line: Number(match[3]), column: Number(match[4]) });
      } else {
        frames.push({ fn: match[1], file: match[2], line: Number(match[3]), column: Number(match[4]) });
      }
    }
  }
  return frames.slice(0, 15);
}

export function analyzeError(input: { error: string; stackTrace?: string }): DebugReport {
  const text = `${input.error}\n${input.stackTrace ?? ''}`;
  const frames = parseFrames(text);
  const matches = KNOWN_ERRORS.filter((entry) => entry.pattern.test(text));
  const language = /\.(ts|tsx)\b/.test(text) ? 'typescript' : /\.(py)\b/.test(text) ? 'python' : /\.(go|rs|java|cs|php)\b/.test(text) ? 'detected' : 'unknown';

  return {
    summary: input.error.split(/\r?\n/)[0].slice(0, 400),
    language,
    frames,
    likelyCauses: matches.length ? matches.map((entry) => entry.cause) : ['No known error signature matched; inspect the first application stack frame.'],
    suggestedFixes: matches.length ? matches.map((entry) => entry.fix) : ['Reproduce with a minimal input, add logging around the failing path, and compare against the last working version.'],
    confidence: matches.length ? Math.min(0.95, 0.6 + matches.length * 0.15) : 0.35,
  };
}
