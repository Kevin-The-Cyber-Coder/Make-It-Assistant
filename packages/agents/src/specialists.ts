import type { PlanStep, TaskType } from '@make-it-ai/shared';
import { analyzeError, generateTests, reviewFiles } from '@make-it-ai/dev-engine';
import { riskLevel, scanSource } from '@make-it-ai/security-engine';
import type { AgentContext, AgentOutput, Specialist } from './types';

async function think(
  context: AgentContext,
  prompt: string,
  taskType: TaskType,
  fallback: string,
): Promise<string> {
  try {
    return await context.chat(prompt, taskType);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.emit('agent:model:fallback', `Model call failed, using deterministic output: ${message.slice(0, 160)}`);
    return fallback;
  }
}

function fileList(context: AgentContext): string {
  return context.files.map((file) => `- ${file.path}`).join('\n') || '(no files supplied)';
}

class ArchitectAgent implements Specialist {
  readonly id = 'architect' as const;
  async run(context: AgentContext): Promise<AgentOutput> {
    const prompt = `Design an architecture for this objective:\n${context.objective}\n\nProject files:\n${fileList(context)}\n\nReturn layers, boundaries, data model, API surface, risks and a phased roadmap.`;
    const summary = await think(context, prompt, 'architecture', 'Layered architecture: presentation -> API -> services -> repositories -> data stores; add background workers for long tasks.');
    return {
      summary,
      artifacts: [{ path: `docs/generated/architecture-${context.taskId}.md`, content: summary }],
      nextSteps: ['Review the proposed boundaries', 'Confirm the technology stack', 'Create implementation tasks'],
    };
  }
}

class DeveloperAgent implements Specialist {
  readonly id = 'developer' as const;
  async run(context: AgentContext): Promise<AgentOutput> {
    const prompt = `Implement the following objective in the supplied project. Return file-by-file changes with complete code.\nOBJECTIVE: ${context.objective}\nFILES:\n${fileList(context)}`;
    const summary = await think(context, prompt, 'generate', 'Implementation draft: define types, add a service with explicit errors, expose versioned routes and add tests. No files were applied automatically.');
    return {
      summary,
      artifacts: [{ path: `docs/generated/implementation-${context.taskId}.md`, content: summary }],
      nextSteps: ['Human approval required before applying file changes', 'Run the generated tests', 'Review the diff'],
    };
  }
}

class DebuggerAgent implements Specialist {
  readonly id = 'debugger' as const;
  async run(context: AgentContext): Promise<AgentOutput> {
    const report = analyzeError({ error: context.objective, stackTrace: context.files.map((file) => file.content.slice(0, 2000)).join('\n') });
    const prompt = `Diagnose this error. Summary: ${report.summary}\nLikely causes: ${report.likelyCauses.join(' | ')}\nExplain the root cause and provide a minimal fix.`;
    const summary = await think(context, prompt, 'debug', `${report.likelyCauses[0]}\n${report.suggestedFixes[0]}`);
    return { summary, findings: report.likelyCauses, artifacts: [], nextSteps: report.suggestedFixes };
  }
}

class TestingAgent implements Specialist {
  readonly id = 'testing' as const;
  async run(context: AgentContext): Promise<AgentOutput> {
    const generated = generateTests(context.files);
    const prompt = `Review these generated tests and recommend missing cases for: ${context.objective}\n${generated.map((test) => test.filePath).join('\n')}`;
    const advice = await think(context, prompt, 'general', 'Add boundary cases, error paths and one integration test per public endpoint.');
    return {
      summary: `Generated ${generated.length} test skeleton(s).\n${advice}`,
      artifacts: generated.map((test) => ({ path: test.filePath, content: test.content })),
      findings: [`${generated.length} files with exported symbols need coverage`],
      nextSteps: ['Approve test generation', 'Run tests in the isolated worker'],
    };
  }
}

class SecurityAgent implements Specialist {
  readonly id = 'security' as const;
  async run(context: AgentContext): Promise<AgentOutput> {
    const scan = scanSource(context.organizationId, context.files, { projectId: context.projectId });
    const prompt = `Provide defensive remediation guidance for these security findings: ${scan.findings.slice(0, 20).map((finding) => `${finding.severity}: ${finding.title}`).join(' | ')}`;
    const advice = await think(context, prompt, 'security', 'Prioritize critical and high findings, rotate exposed credentials and apply least privilege.');
    return {
      summary: `Risk: ${riskLevel(scan)}. ${scan.findings.length} finding(s). ${advice}`,
      findings: scan.findings.map((finding) => `[${finding.severity}] ${finding.title} (${finding.filePath ?? 'project'})`),
      artifacts: [],
      nextSteps: ['Remediate critical findings first', 'Re-scan after changes', 'Document accepted risks'],
    };
  }
}

class ReviewerAgent implements Specialist {
  readonly id = 'reviewer' as const;
  async run(context: AgentContext): Promise<AgentOutput> {
    const review = reviewFiles(context.files);
    const prompt = `Summarize this code review for a pull request: ${review.summary}\nTop findings: ${review.findings.slice(0, 10).map((finding) => finding.title).join(' | ')}`;
    const summary = await think(context, prompt, 'general', review.summary);
    return {
      summary,
      findings: review.findings.slice(0, 30).map((finding) => `[${finding.severity}] ${finding.title} at ${finding.filePath}`),
      artifacts: [{ path: `docs/generated/review-${context.taskId}.md`, content: summary }],
      nextSteps: ['Address high severity findings', 'Add tests for changed behaviour'],
    };
  }
}

class DocumentationAgent implements Specialist {
  readonly id = 'documentation' as const;
  async run(context: AgentContext): Promise<AgentOutput> {
    const prompt = `Write concise technical documentation for this project based on the files:\n${fileList(context)}\nObjective: ${context.objective}\nInclude overview, setup, configuration, testing and deployment.`;
    const summary = await think(context, prompt, 'documentation', '# Documentation outline\n## Overview\n## Installation\n## Configuration\n## Usage\n## Testing\n## Deployment');
    return {
      summary,
      artifacts: [{ path: `docs/generated/documentation-${context.taskId}.md`, content: summary }],
      nextSteps: ['Verify documented commands', 'Remove generated drafts once reviewed'],
    };
  }
}

class DevOpsAgent implements Specialist {
  readonly id = 'devops' as const;
  async run(context: AgentContext): Promise<AgentOutput> {
    const prompt = `Recommend build, test, security and deployment automation for: ${context.objective}\nFiles:\n${fileList(context)}`;
    const summary = await think(context, prompt, 'general', 'CI stages: install -> lint -> typecheck -> unit tests -> build -> security scan. Deploy the API and workers separately from the frontend.');
    return {
      summary,
      artifacts: [{ path: `docs/generated/devops-${context.taskId}.md`, content: summary }],
      nextSteps: ['Validate workflow permissions', 'Keep production secrets in the CI secret store'],
    };
  }
}

class OrchestratorAgent implements Specialist {
  readonly id = 'orchestrator' as const;
  async run(context: AgentContext, step: PlanStep): Promise<AgentOutput> {
    if (step.title === 'Index project context') {
      return {
        summary: `Indexed ${context.files.length} file(s) for task context.`,
        findings: context.files.slice(0, 20).map((file) => file.path),
        artifacts: [],
      };
    }
    return {
      summary: context.plan.map((item) => `${item.status.toUpperCase()}: ${item.title} (${item.agent})`).join('\n'),
      artifacts: [],
      nextSteps: ['Review the task output', 'Approve any staged file changes'],
    };
  }
}

export const SPECIALISTS: Record<string, Specialist> = {
  orchestrator: new OrchestratorAgent(),
  architect: new ArchitectAgent(),
  developer: new DeveloperAgent(),
  debugger: new DebuggerAgent(),
  testing: new TestingAgent(),
  security: new SecurityAgent(),
  reviewer: new ReviewerAgent(),
  documentation: new DocumentationAgent(),
  devops: new DevOpsAgent(),
};
