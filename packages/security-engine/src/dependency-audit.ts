import type { ProjectFile } from '@make-it-ai/shared';
import { analyzeDependencies } from '@make-it-ai/project-intelligence';
import { queryOsv, type OsvConfig, type OsvPackage, type OsvResult } from './osv';
import type { FindingDraft } from './types';

interface OfflineAdvisory {
  package: string;
  below: string;
  title: string;
  severity: FindingDraft['severity'];
  remediation: string;
}

// Deliberately small, explainable offline heuristic set. This is NOT a substitute for
// `npm audit`, `pip-audit` or a live advisory database, and says so in every finding.
const OFFLINE_ADVISORIES: OfflineAdvisory[] = [
  { package: 'request', below: '999.0.0', title: 'Deprecated HTTP client', severity: 'medium', remediation: 'Migrate to undici, axios or native fetch.' },
  { package: 'lodash', below: '4.17.21', title: 'Outdated lodash version', severity: 'high', remediation: 'Upgrade to 4.17.21 or later and run npm audit.' },
  { package: 'minimist', below: '1.2.6', title: 'Outdated minimist version', severity: 'high', remediation: 'Upgrade to 1.2.6 or later.' },
  { package: 'axios', below: '1.6.0', title: 'Outdated axios version', severity: 'high', remediation: 'Upgrade to 1.6.0 or later and run npm audit.' },
  { package: 'jsonwebtoken', below: '9.0.0', title: 'Outdated jsonwebtoken version', severity: 'high', remediation: 'Upgrade to 9.0.0 or later and pin allowed algorithms.' },
  { package: 'node-forge', below: '1.3.0', title: 'Outdated node-forge version', severity: 'high', remediation: 'Upgrade to 1.3.0 or later.' },
  { package: 'tough-cookie', below: '4.1.3', title: 'Outdated tough-cookie version', severity: 'medium', remediation: 'Upgrade to 4.1.3 or later.' },
];

function parseVersion(value: string): number[] {
  return value.replace(/^[^\d]*/, '').split(/[.\-+]/).map((part) => Number.parseInt(part, 10) || 0);
}

function isBelow(current: string, minimum: string): boolean {
  const a = parseVersion(current);
  const b = parseVersion(minimum);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    if (left < right) return true;
    if (left > right) return false;
  }
  return false;
}

/** Best-effort conversion of a manifest range to an exact version OSV can query. */
export function normalizeVersion(specifier: string): string | null {
  const first = specifier.split('||')[0].trim();
  const match = first.match(/\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?/);
  return match ? match[0] : null;
}

function offlineFindings(files: ProjectFile[]): FindingDraft[] {
  const { dependencies, ecosystem, manifests } = analyzeDependencies(files);
  const findings: FindingDraft[] = [];

  for (const advisory of OFFLINE_ADVISORIES) {
    const installed = dependencies[advisory.package];
    if (!installed) continue;
    const normalized = installed.replace(/^[\^~>=<\s]*/, '');
    if (!isBelow(normalized, advisory.below)) continue;
    findings.push({
      severity: advisory.severity,
      category: 'dependency-health',
      title: advisory.title,
      description: `${advisory.package} ${installed} is below the offline review threshold ${advisory.below}. This is a heuristic check, not a live CVE lookup.`,
      filePath: manifests[0],
      evidence: `${advisory.package}: ${installed}`,
      remediation: `${advisory.remediation}. Run the ecosystem-native audit tool for authoritative results.`,
      references: ['https://docs.npmjs.com/cli/audit'],
    });
  }

  if (ecosystem.length === 0) {
    findings.push({
      severity: 'info',
      category: 'dependency-health',
      title: 'No dependency manifest detected',
      description: 'No supported manifest was found, so dependency health could not be assessed offline.',
      remediation: 'Add a package manager manifest and commit it to version control.',
      references: [],
    });
  }

  return findings;
}

export function auditDependencies(files: ProjectFile[]): FindingDraft[] {
  return offlineFindings(files);
}

/** Offline heuristics plus a live OSV batch query when enabled. */
export async function auditDependenciesLive(
  files: ProjectFile[],
  osv?: OsvConfig,
): Promise<{ findings: FindingDraft[]; advisory: OsvResult | null }> {
  const findings = offlineFindings(files);
  if (!osv?.enabled) return { findings, advisory: null };

  const { dependencies, ecosystem, manifests } = analyzeDependencies(files);
  const primaryEcosystem = ecosystem[0] ?? 'npm';
  const packages: OsvPackage[] = Object.entries(dependencies)
    .map(([name, specifier]) => ({ name, version: normalizeVersion(specifier) ?? '', ecosystem: primaryEcosystem }))
    .filter((pkg) => pkg.version);

  const advisory = await queryOsv(osv, packages, manifests[0]);
  return { findings: [...findings, ...advisory.findings], advisory };
}
