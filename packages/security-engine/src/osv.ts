import type { Severity } from '@make-it-ai/shared';
import type { FindingDraft } from './types';

export interface OsvConfig {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  maxPackages: number;
}

export interface OsvPackage {
  name: string;
  version: string;
  ecosystem: string;
}

export interface OsvVulnerability {
  id: string;
  aliases?: string[];
  summary?: string;
  details?: string;
  references?: Array<{ type?: string; url: string }>;
  database_specific?: { severity?: string };
  severity?: Array<{ type?: string; score?: string }>;
}

export interface OsvResult {
  source: 'osv';
  queriedAt: string;
  queriedPackages: number;
  success: boolean;
  error?: string;
  findings: FindingDraft[];
}

const ECOSYSTEMS: Record<string, string> = {
  npm: 'npm',
  python: 'PyPI',
  go: 'Go',
  rust: 'crates.io',
  php: 'Packagist',
  ruby: 'RubyGems',
};

export function osvEcosystem(ecosystem: string | undefined): string | null {
  return ecosystem ? ECOSYSTEMS[ecosystem.toLowerCase()] ?? null : null;
}

function mapSeverity(vulnerability: OsvVulnerability): Severity {
  const declared = vulnerability.database_specific?.severity?.toLowerCase();
  if (declared && ['critical', 'high', 'medium', 'low', 'info'].includes(declared)) {
    return declared as Severity;
  }
  const vector = vulnerability.severity?.find((entry) => entry.type?.toUpperCase().startsWith('CVSS'))?.score ?? '';
  if (/CVSS:4\.0/.test(vector)) return 'medium';
  if (/CVSS:3/.test(vector)) return 'medium';
  return 'medium';
}

function toFinding(vulnerability: OsvVulnerability, pkg: OsvPackage, filePath?: string): FindingDraft {
  const aliases = (vulnerability.aliases ?? []).slice(0, 5);
  const references = (vulnerability.references ?? [])
    .map((reference) => reference.url)
    .filter(Boolean)
    .slice(0, 5);
  return {
    severity: mapSeverity(vulnerability),
    category: 'dependency-vulnerability',
    title: `${vulnerability.id}: ${pkg.name} ${pkg.version}`,
    description: [
      vulnerability.summary || vulnerability.details || 'OSV advisory returned for this dependency.',
      aliases.length ? `Aliases: ${aliases.join(', ')}.` : '',
      'Live advisory data from the OSV API. Confirm the affected range against your resolved lockfile.',
    ].filter(Boolean).join(' ').slice(0, 700),
    filePath,
    evidence: `${pkg.ecosystem}/${pkg.name}@${pkg.version}`,
    remediation: 'Upgrade to a version outside the affected ranges listed in the OSV record, then rerun the audit.',
    references: [`https://osv.dev/vulnerability/${encodeURIComponent(vulnerability.id)}`, ...references],
  };
}

/**
 * Queries the public OSV batch endpoint. Network or parse failures are returned
 * as a failed result rather than thrown, so a scan still completes offline.
 */
export async function queryOsv(
  config: OsvConfig,
  packages: OsvPackage[],
  filePath?: string,
): Promise<OsvResult> {
  const queriedAt = new Date().toISOString();
  const selected = packages
    .filter((pkg) => pkg.name && pkg.version && osvEcosystem(pkg.ecosystem))
    .slice(0, Math.max(1, config.maxPackages));

  if (!config.enabled || selected.length === 0) {
    return { source: 'osv', queriedAt, queriedPackages: 0, success: true, findings: [] };
  }

  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/v1/querybatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'make-it-ai-security-engine',
      },
      body: JSON.stringify({
        queries: selected.map((pkg) => ({
          package: { name: pkg.name, ecosystem: osvEcosystem(pkg.ecosystem) },
          version: pkg.version,
        })),
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) throw new Error(`OSV returned HTTP ${response.status}`);

    const body = await response.json() as { results?: Array<{ vulns?: OsvVulnerability[] }> };
    const findings: FindingDraft[] = [];
    selected.forEach((pkg, index) => {
      for (const vulnerability of body.results?.[index]?.vulns ?? []) {
        findings.push(toFinding(vulnerability, pkg, filePath));
      }
    });
    return { source: 'osv', queriedAt, queriedPackages: selected.length, success: true, findings };
  } catch (error) {
    return {
      source: 'osv',
      queriedAt,
      queriedPackages: selected.length,
      success: false,
      error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
      findings: [],
    };
  }
}
