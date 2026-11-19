export interface OwaspCategory {
  id: string;
  name: string;
  guidance: string;
  checks: string[];
}

export const OWASP_TOP_10: OwaspCategory[] = [
  { id: 'A01', name: 'Broken Access Control', guidance: 'Deny by default and enforce authorization on every request and object reference.', checks: ['Object-level authorization', 'Least privilege roles', 'Direct object reference checks'] },
  { id: 'A02', name: 'Cryptographic Failures', guidance: 'Use modern ciphers, strong hashing for passwords, and never transmit secrets in clear text.', checks: ['TLS enforced', 'Argon2/bcrypt password hashing', 'No secrets in source'] },
  { id: 'A03', name: 'Injection', guidance: 'Use parameterized queries, output encoding and strict input validation.', checks: ['SQL parameters', 'Safe DOM sinks', 'No shell interpolation'] },
  { id: 'A04', name: 'Insecure Design', guidance: 'Threat-model before implementation and add abuse cases to tests.', checks: ['Rate limits', 'Business logic abuse cases', 'Secure defaults'] },
  { id: 'A05', name: 'Security Misconfiguration', guidance: 'Harden defaults, remove debug features and keep dependencies patched.', checks: ['Security headers', 'CORS allowlist', 'Disabled debug mode'] },
  { id: 'A06', name: 'Vulnerable and Outdated Components', guidance: 'Maintain an SBOM and continuously scan dependencies.', checks: ['Lockfile committed', 'Automated audit in CI', 'Patch policy'] },
  { id: 'A07', name: 'Identification and Authentication Failures', guidance: 'Use secure session handling, MFA where possible and safe credential recovery.', checks: ['Password hashing', 'Refresh token rotation', 'Rate-limited login'] },
  { id: 'A08', name: 'Software and Data Integrity Failures', guidance: 'Verify signatures and avoid unsafe deserialization of untrusted data.', checks: ['Signed artifacts', 'No eval of remote data', 'Integrity checks'] },
  { id: 'A09', name: 'Security Logging and Monitoring Failures', guidance: 'Log security-relevant events without logging secrets and alert on anomalies.', checks: ['Audit logs', 'Redaction', 'Alerting'] },
  { id: 'A10', name: 'Server-Side Request Forgery', guidance: 'Allowlist destinations and disable unnecessary outbound network access.', checks: ['URL allowlist', 'No redirect following to internal networks', 'Network egress rules'] },
];

export function owaspById(id: string): OwaspCategory | undefined {
  return OWASP_TOP_10.find((category) => category.id === id);
}
