import type { ProjectFile } from '@make-it-ai/shared';
import { lineOf, redact, type FindingDraft } from './types';

const PATTERNS: Array<{ name: string; regex: RegExp; severity: FindingDraft['severity']; remediation: string }> = [
  {
    name: 'AWS access key',
    regex: /AKIA[0-9A-Z]{16}/g,
    severity: 'critical',
    remediation: 'Revoke the key in IAM immediately, rotate it, and load credentials from a secret manager or environment variables.',
  },
  {
    name: 'Private key material',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    severity: 'critical',
    remediation: 'Remove the key from source control, rotate it, and store it in a secret manager with restricted access.',
  },
  {
    name: 'JSON Web Token',
    regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    severity: 'high',
    remediation: 'Remove the token, invalidate it, and never commit bearer credentials.',
  },
  {
    name: 'Hardcoded credential assignment',
    regex: /(?:api[_-]?key|secret|password|passwd|access[_-]?token)\s*[:=]\s*["'][^"'\n]{8,}["']/gi,
    severity: 'high',
    remediation: 'Move the value to an environment variable or encrypted secret store and rotate the exposed credential.',
  },
  {
    name: 'Database connection string with inline password',
    regex: /(?:mongodb|postgres(?:ql)?|mysql|redis):\/\/[^:\s"']+:([^@\s"']{4,})@/gi,
    severity: 'critical',
    remediation: 'Remove the inline password, rotate the database credential, and inject it from a secret store.',
  },
];

export function detectSecrets(files: ProjectFile[]): FindingDraft[] {
  const findings: FindingDraft[] = [];
  for (const file of files) {
    for (const pattern of PATTERNS) {
      for (const match of file.content.matchAll(pattern.regex)) {
        findings.push({
          severity: pattern.severity,
          category: 'secret-exposure',
          title: `${pattern.name} exposed in source`,
          description: `A ${pattern.name.toLowerCase()} pattern was found in ${file.path}. Treat it as compromised.`,
          filePath: file.path,
          line: lineOf(file.content, match.index ?? 0),
          evidence: redact(match[0]),
          remediation: pattern.remediation,
          references: ['https://owasp.org/Top10/A05_2021-Security_Misconfiguration/'],
        });
      }
    }
  }
  return findings;
}
