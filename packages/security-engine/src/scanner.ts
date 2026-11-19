import type { ProjectFile, SecurityFinding, SecurityScan, Severity } from '@make-it-ai/shared';
import { analyzeConfiguration } from './config-analyzer';
import { auditDependencies, auditDependenciesLive } from './dependency-audit';
import type { OsvConfig, OsvResult } from './osv';
import { detectSecrets } from './secret-detector';
import { runSast } from './sast-rules';
import type { FindingDraft } from './types';

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

function finalizeScan(
  organizationId: string,
  drafts: FindingDraft[],
  options: { scanId?: string; projectId?: string; filesScanned: number },
): SecurityScan {
  const scanId = options.scanId ?? crypto.randomUUID();
  const seen = new Set<string>();
  const findings: SecurityFinding[] = drafts
    .filter((draft) => {
      const key = `${draft.category}:${draft.filePath ?? ''}:${draft.line ?? ''}:${draft.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((draft) => ({
      ...draft,
      id: crypto.randomUUID(),
      organizationId,
      scanId,
      projectId: options.projectId,
      createdAt: new Date().toISOString(),
    }));

  const summary = SEVERITIES.reduce<Record<Severity, number>>(
    (acc, severity) => ({ ...acc, [severity]: findings.filter((item) => item.severity === severity).length }),
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
  );

  return {
    id: scanId,
    organizationId,
    projectId: options.projectId,
    status: 'completed',
    filesScanned: options.filesScanned,
    findings,
    summary,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
}

export function scanSource(
  organizationId: string,
  files: ProjectFile[],
  options: { scanId?: string; projectId?: string } = {},
): SecurityScan {
  const drafts: FindingDraft[] = [
    ...detectSecrets(files),
    ...runSast(files),
    ...analyzeConfiguration(files),
    ...auditDependencies(files),
  ];
  return finalizeScan(organizationId, drafts, { ...options, filesScanned: files.length });
}

/** Async variant that adds live OSV advisories when configured. */
export async function scanSourceLive(
  organizationId: string,
  files: ProjectFile[],
  options: { scanId?: string; projectId?: string; osv?: OsvConfig } = {},
): Promise<{ scan: SecurityScan; advisory: OsvResult | null }> {
  const { findings: dependencyFindings, advisory } = await auditDependenciesLive(files, options.osv);
  const drafts: FindingDraft[] = [
    ...detectSecrets(files),
    ...runSast(files),
    ...analyzeConfiguration(files),
    ...dependencyFindings,
  ];
  return {
    scan: finalizeScan(organizationId, drafts, { ...options, filesScanned: files.length }),
    advisory,
  };
}

export function riskLevel(scan: SecurityScan): 'critical' | 'high' | 'medium' | 'low' | 'clean' {
  if (scan.summary.critical > 0) return 'critical';
  if (scan.summary.high > 0) return 'high';
  if (scan.summary.medium > 0) return 'medium';
  if (scan.summary.low > 0) return 'low';
  // Informational findings explain limited coverage but do not indicate risk by themselves.
  return 'clean';
}
