import type { ProjectFile } from '@make-it-ai/shared';
import { lineOf, redact, type FindingDraft } from './types';

interface Rule {
  id: string;
  pattern: RegExp;
  severity: FindingDraft['severity'];
  title: string;
  description: string;
  remediation: string;
  reference: string;
}

export const SAST_RULES: Rule[] = [
  {
    id: 'JS-EVAL',
    pattern: /\beval\s*\(|\bnew Function\s*\(/g,
    severity: 'critical',
    title: 'Dynamic code evaluation',
    description: 'eval/new Function execute attacker-controlled strings and can lead to remote code execution.',
    remediation: 'Replace with explicit parsing (JSON.parse with validation) or a safe expression parser.',
    reference: 'https://owasp.org/www-community/attacks/Code_Injection',
  },
  {
    id: 'JS-INNERHTML',
    pattern: /\.innerHTML\s*=|document\.write\s*\(/g,
    severity: 'high',
    title: 'Unsafe DOM sink',
    description: 'Writing untrusted data to innerHTML or document.write enables cross-site scripting.',
    remediation: 'Use textContent, safe DOM APIs, or a sanitizer such as DOMPurify.',
    reference: 'https://owasp.org/Top10/A03_2021-Injection/',
  },
  {
    id: 'SQL-CONCAT',
    pattern: /(?:SELECT|INSERT|UPDATE|DELETE)[^\n;]*?(?:\+|`\$\{|\$\{)/gi,
    severity: 'critical',
    title: 'SQL query built from string concatenation',
    description: 'Concatenated SQL allows injection when any fragment is user-controlled.',
    remediation: 'Use parameterized queries or an ORM with bound parameters.',
    reference: 'https://owasp.org/Top10/A03_2021-Injection/',
  },
  {
    id: 'SHELL-EXEC',
    pattern: /(?:child_process\.)?(?:exec|execSync)\s*\([^)]*(?:\+|`|\$\{)/g,
    severity: 'critical',
    title: 'Shell command built from dynamic input',
    description: 'Dynamic shell commands allow command injection.',
    remediation: 'Use execFile/spawn with an argument array and an allowlist of commands.',
    reference: 'https://owasp.org/www-community/attacks/Command_Injection',
  },
  {
    id: 'WEAK-HASH',
    pattern: /createHash\(\s*['"](?:md5|sha1)['"]\s*\)|hashlib\.(?:md5|sha1)\s*\(/gi,
    severity: 'medium',
    title: 'Weak cryptographic hash',
    description: 'MD5 and SHA-1 are unsuitable for passwords or integrity-sensitive use.',
    remediation: 'Use SHA-256 for fingerprints and argon2/bcrypt/scrypt for passwords.',
    reference: 'https://owasp.org/Top10/A02_2021-Cryptographic_Failures/',
  },
  {
    id: 'TLS-DISABLED',
    pattern: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/g,
    severity: 'high',
    title: 'TLS verification disabled',
    description: 'Disabling certificate verification enables machine-in-the-middle attacks.',
    remediation: 'Keep verification enabled and install the correct CA certificate.',
    reference: 'https://owasp.org/Top10/A02_2021-Cryptographic_Failures/',
  },
  {
    id: 'JWT-NONE',
    pattern: /algorithms\s*:\s*\[?\s*['"]none['"]/gi,
    severity: 'critical',
    title: 'JWT algorithm "none" permitted',
    description: 'Accepting the none algorithm bypasses token signature verification.',
    remediation: 'Pin a single expected asymmetric algorithm such as RS256 or EdDSA.',
    reference: 'https://owasp.org/www-community/attacks/jwt_attacks',
  },
  {
    id: 'PY-PICKLE',
    pattern: /\bpickle\.loads?\s*\(|\byaml\.load\s*\(/g,
    severity: 'critical',
    title: 'Unsafe deserialization',
    description: 'Deserializing untrusted pickle or YAML data can execute arbitrary code.',
    remediation: 'Use json.loads or yaml.safe_load and validate the resulting schema.',
    reference: 'https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/',
  },
  {
    id: 'PERMISSIVE-CORS',
    pattern: /origin\s*:\s*['"]\*['"]/g,
    severity: 'medium',
    title: 'Permissive CORS origin',
    description: 'A wildcard CORS origin allows any site to read responses from authenticated endpoints.',
    remediation: 'Allowlist exact origins and enable credentials only for trusted clients.',
    reference: 'https://owasp.org/Top10/A05_2021-Security_Misconfiguration/',
  },
];

export function runSast(files: ProjectFile[]): FindingDraft[] {
  const findings: FindingDraft[] = [];
  for (const file of files) {
    for (const rule of SAST_RULES) {
      for (const match of file.content.matchAll(rule.pattern)) {
        findings.push({
          severity: rule.severity,
          category: `sast:${rule.id}`,
          title: rule.title,
          description: rule.description,
          filePath: file.path,
          line: lineOf(file.content, match.index ?? 0),
          evidence: redact(match[0]),
          remediation: rule.remediation,
          references: [rule.reference],
        });
      }
    }
  }
  return findings;
}
