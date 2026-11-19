import { AppError, AGENT_EVENTS, type ProjectFile } from '@make-it-ai/shared';
import { scanSource } from '@make-it-ai/security-engine';
import { generateTests } from '@make-it-ai/dev-engine';
import type { AgentContext } from './types';

export interface ToolDefinition {
  name: string;
  description: string;
  permission: 'read' | 'write' | 'execute';
  requiresApproval: boolean;
  run: (args: Record<string, unknown>, context: AgentContext) => Promise<unknown>;
}

function safePath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!normalized || normalized.includes('..') || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    throw new AppError('BAD_REQUEST', `Unsafe tool path: ${path}`);
  }
  return normalized;
}

export const TOOLS: ToolDefinition[] = [
  {
    name: 'list_files',
    description: 'List project file paths.',
    permission: 'read',
    requiresApproval: false,
    run: async (_args, context) => context.files.map((file) => file.path),
  },
  {
    name: 'read_file',
    description: 'Read a project file by path.',
    permission: 'read',
    requiresApproval: false,
    run: async (args, context) => {
      const path = safePath(String(args.path ?? ''));
      const file = context.files.find((candidate) => candidate.path === path);
      if (!file) throw new AppError('NOT_FOUND', `File not found: ${path}`);
      return file.content.slice(0, 50_000);
    },
  },
  {
    name: 'search_code',
    description: 'Search project files for a literal term.',
    permission: 'read',
    requiresApproval: false,
    run: async (args, context) => {
      const term = String(args.term ?? '').toLowerCase();
      if (!term) return [];
      return context.files
        .filter((file: ProjectFile) => file.content.toLowerCase().includes(term))
        .map((file) => file.path);
    },
  },
  {
    name: 'analyze_security',
    description: 'Run offline defensive security analysis on project files.',
    permission: 'read',
    requiresApproval: false,
    run: async (_args, context) => {
      const scan = scanSource(context.organizationId, context.files, { projectId: context.projectId });
      return { risk: scan.summary, findings: scan.findings.map((finding) => ({ ...finding, evidence: undefined })) };
    },
  },
  {
    name: 'generate_tests',
    description: 'Generate test skeletons for source files.',
    permission: 'read',
    requiresApproval: false,
    run: async (args, context) => generateTests(context.files, String(args.framework ?? 'auto')),
  },
  {
    name: 'write_file',
    description: 'Stage a file change into task artifacts. Requires human approval before application.',
    permission: 'write',
    requiresApproval: true,
    run: async (args, context) => {
      const path = safePath(String(args.path ?? ''));
      const content = String(args.content ?? '');
      context.artifacts.push({ path, content });
      return { staged: path, bytes: content.length, applied: false };
    },
  },
  {
    name: 'run_tests',
    description: 'Request test execution through the isolated worker. Requires approval.',
    permission: 'execute',
    requiresApproval: true,
    run: async (args, context) => {
      const command = String(args.command ?? 'npm test');
      context.emit(AGENT_EVENTS.TOOL_STARTED, `Execution requested: ${command}`, { command });
      if (!context.executor) {
        return {
          executed: false,
          reason: 'No isolated execution worker is attached. Configure SANDBOX_URL to enable approved command execution.',
          command,
        };
      }
      const result = await context.executor(command);
      return { executed: true, command, ...result };
    },
  },
];

export class ToolRegistry {
  private readonly tools = new Map(TOOLS.map((tool) => [tool.name, tool]));

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  async invoke(name: string, args: Record<string, unknown>, context: AgentContext): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new AppError('NOT_FOUND', `Unknown tool: ${name}`);
    context.emit(AGENT_EVENTS.TOOL_STARTED, `Tool ${name} started`, { tool: name, permission: tool.permission });
    if (tool.requiresApproval) {
      const approved = await context.requestApproval(
        {
          id: `${context.taskId}:${name}:${Date.now()}`,
          agent: 'orchestrator',
          title: `Approve ${name}`,
          description: `Tool ${name} requests ${tool.permission} permission with args ${JSON.stringify(args).slice(0, 300)}`,
          status: 'awaiting_approval',
          requiresApproval: true,
        },
        name,
        JSON.stringify(args).slice(0, 500),
      );
      if (!approved) throw new AppError('FORBIDDEN', `Approval denied for tool ${name}`);
    }
    const result = await tool.run(args, context);
    context.emit(AGENT_EVENTS.TOOL_COMPLETED, `Tool ${name} completed`, { tool: name });
    return result;
  }
}
