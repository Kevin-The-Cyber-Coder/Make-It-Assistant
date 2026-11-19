import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  AppError,
  indexSchema,
  paginationSchema,
  projectCreateSchema,
  projectUpdateSchema,
} from '@make-it-ai/shared';
import type { Project } from '@make-it-ai/shared';
import { buildTree, detectLanguage, indexProject, scanFiles, searchProject } from '@make-it-ai/project-intelligence';
import type { AppContext } from '../../context';
import { audit } from '../../lib/audit';
import { requireAuth, validate } from '../../middleware';

async function ownedProject(context: AppContext, request: Parameters<typeof audit>[1], id: string): Promise<Project> {
  const project = await context.db.repositories.projects.findById(id);
  if (!project || project.organizationId !== request.actor!.organizationId) {
    throw new AppError('NOT_FOUND', 'Project not found');
  }
  return project;
}

export function createProjectRouter(context: AppContext): Router {
  const router = Router();
  router.use(requireAuth(context));

  router.get('/', async (request, response) => {
    const query = paginationSchema.parse(request.query);
    const projects = await context.db.repositories.projects.find({
      where: { organizationId: request.actor!.organizationId },
      sort: { field: 'updatedAt', direction: 'desc' },
      limit: query.limit,
      offset: query.offset,
    });
    response.json({ projects, total: await context.db.repositories.projects.count({ where: { organizationId: request.actor!.organizationId } }) });
  });

  router.post('/', validate(projectCreateSchema), async (request, response) => {
    const input = request.body as ReturnType<typeof projectCreateSchema.parse>;
    const now = new Date().toISOString();
    const project: Project = {
      id: `prj_${randomUUID()}`,
      organizationId: request.actor!.organizationId,
      name: input.name,
      description: input.description,
      rootPath: input.rootPath,
      languages: [],
      frameworks: [],
      createdAt: now,
      updatedAt: now,
    };
    await context.db.repositories.projects.create(project);
    await audit(context, request, 'project.create', 'project', project.id, { name: project.name });
    response.status(201).json({ project });
  });

  router.get('/:id', async (request, response) => {
    response.json({ project: await ownedProject(context, request, request.params.id) });
  });

  router.put('/:id', validate(projectUpdateSchema), async (request, response) => {
    const project = await ownedProject(context, request, request.params.id);
    const updated = await context.db.repositories.projects.update(project.id, {
      ...(request.body as Record<string, unknown>),
      updatedAt: new Date().toISOString(),
    });
    await audit(context, request, 'project.update', 'project', project.id);
    response.json({ project: updated });
  });

  router.delete('/:id', async (request, response) => {
    if (!request.actor!.roles.some((role) => role === 'owner' || role === 'admin')) {
      throw new AppError('FORBIDDEN', 'Owner or admin role required');
    }
    const project = await ownedProject(context, request, request.params.id);
    await context.db.repositories.projects.delete(project.id);
    context.indexes.delete(project.id);
    await audit(context, request, 'project.delete', 'project', project.id);
    response.json({ success: true });
  });

  router.post('/:id/index', validate(indexSchema), async (request, response) => {
    const project = await ownedProject(context, request, request.params.id);
    const input = request.body as ReturnType<typeof indexSchema.parse>;
    const prepared = input.files.map((file) => ({
      path: file.path,
      content: file.content,
      language: detectLanguage(file.path),
      size: file.content.length,
    }));
    const index = indexProject(project.id, prepared);
    const stats = scanFiles(prepared);
    context.indexes.set(project.id, index);
    await context.db.repositories.projects.update(project.id, {
      languages: index.languages,
      frameworks: index.frameworks,
      updatedAt: new Date().toISOString(),
    });
    await audit(context, request, 'project.index', 'project', project.id, { files: stats.fileCount });
    response.json({
      projectId: project.id,
      fileCount: stats.fileCount,
      lineCount: stats.lineCount,
      languages: index.languages,
      frameworks: index.frameworks,
      entryPoints: index.entryPoints,
      dependencies: index.dependencies,
    });
  });

  router.get('/:id/files', async (request, response) => {
    await ownedProject(context, request, request.params.id);
    const index = context.indexes.get(request.params.id);
    response.json({
      files: (index?.files ?? []).map((file) => ({ path: file.path, language: file.language, size: file.size })),
    });
  });

  router.get('/:id/file/*', async (request, response) => {
    await ownedProject(context, request, request.params.id);
    const filePath = (request.params as Record<string, string>)['0'];
    const index = context.indexes.get(request.params.id);
    const file = index?.files.find((candidate) => candidate.path === filePath);
    if (!file) throw new AppError('NOT_FOUND', 'File not found in project index');
    response.json({ file });
  });

  router.get('/:id/tree', async (request, response) => {
    await ownedProject(context, request, request.params.id);
    const index = context.indexes.get(request.params.id);
    response.json({ tree: index ? buildTree(index.files) : [] });
  });

  router.get('/:id/search', async (request, response) => {
    await ownedProject(context, request, request.params.id);
    const index = context.indexes.get(request.params.id);
    const query = String(request.query.q ?? '');
    if (!index || !query) return response.json({ files: [] });
    return response.json({
      files: searchProject(index, query, 20).map((file) => ({ path: file.path, language: file.language, size: file.size })),
    });
  });

  return router;
}
