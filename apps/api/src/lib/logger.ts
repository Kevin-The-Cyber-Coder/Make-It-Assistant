export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE = /(password|secret|token|api[_-]?key|authorization|cookie)/i;

function sanitize(value: unknown): unknown {
  if (typeof value === 'string') return SENSITIVE.test(value) ? '[REDACTED]' : value.slice(0, 1000);
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, SENSITIVE.test(key) ? '[REDACTED]' : sanitize(nested)]),
    );
  }
  return value;
}

export class Logger {
  constructor(private readonly level: LogLevel = 'info') {}

  private emit(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    const order: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    if (order.indexOf(level) < order.indexOf(this.level)) return;
    const entry = { timestamp: new Date().toISOString(), level, message, ...(metadata ? { metadata: sanitize(metadata) } : {}) };
    const line = JSON.stringify(entry);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }

  debug(message: string, metadata?: Record<string, unknown>): void { this.emit('debug', message, metadata); }
  info(message: string, metadata?: Record<string, unknown>): void { this.emit('info', message, metadata); }
  warn(message: string, metadata?: Record<string, unknown>): void { this.emit('warn', message, metadata); }
  error(message: string, metadata?: Record<string, unknown>): void { this.emit('error', message, metadata); }
}
