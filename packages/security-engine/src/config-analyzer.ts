import type { ProjectFile } from '@make-it-ai/shared';
import { lineOf, redact, type FindingDraft } from './types';

const RULES: Array<{ pattern: RegExp; title: string; severity: FindingDraft['severity']; remediation: string }> = [
  {
    pattern: /\bDEBUG\s*[:=]\s*true\b|\bAPP_DEBUG\s*=\s*true/gi,
    title: 'Debug mode enabled',
    severity: 'medium',
    remediation: 'Disable debug mode in any non-local environment.',
  },
  {
    pattern: /helmet\s*\(\s*\{\s*[^)]*contentSecurityPolicy\s*:\s*false/gi,
    title: 'Security headers disabled',
    severity: 'medium',
    remediation: 'Restore Content-Security-Policy and other security headers.',
  },
  {
    pattern: /csrf\s*\(\s*\{\s*[^)]*false|disableCSRF\s*[:=]\s*true/gi,
    title: 'CSRF protection disabled',
    severity: 'high',
    remediation: 'Enable CSRF protection for cookie-authenticated state-changing routes.',
  },
  {
    pattern: /permissions\s*:\s*['"]\*{1,2}['"]|chmod\s+777/gi,
    title: 'Overly broad permissions',
    severity: 'high',
    remediation: 'Grant least-privilege permissions to files, tokens and service roles.',
  },
  {
    pattern: /trust\s+all|trust\s+.*0\.0\.0\.0\/0/gi,
    title: 'Network access unrestricted',
    severity: 'medium',
    remediation: 'Restrict ingress/egress to known CIDR ranges.',
  },
];

export function analyzeConfiguration(files: ProjectFile[]): FindingDraft[] {
  const findings: FindingDraft[] = [];
  const configFiles = files.filter((file) =>
    /\.(?:env|ya?ml|json|toml|ini|conf)$/i.test(file.path) || /(?:config|settings)/i.test(file.path),
  );
  for (const file of configFiles) {
    for (const rule of RULES) {
      for (const match of file.content.matchAll(rule.pattern)) {
        findings.push({
          severity: rule.severity,
          category: 'insecure-configuration',
          title: rule.title,
          description: `Potentially insecure setting detected in ${file.path}.`,
          filePath: file.path,
          line: lineOf(file.content, match.index ?? 0),
          evidence: redact(match[0]),
          remediation: rule.remediation,
          references: ['https://owasp.org/Top10/A05_2021-Security_Misconfiguration/'],
        });
      }
    }
  }
  return findings;
}
