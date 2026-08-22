import { prisma } from '../../database/prisma';
import { ProjectNotFoundError, ForbiddenError } from '../../common/errors/AppError';

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
}

export class ProjectService {
  async listProjects(orgId: string) {
    const projects = await prisma.project.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: {
            tasks: {
              where: { deletedAt: null }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return projects.map((p) => ({
      ...p,
      taskCount: p._count.tasks
    }));
  }

  async getProjectById(projectId: string, orgId: string) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!project) {
      throw new ProjectNotFoundError();
    }

    // Cross-tenant protection check
    if (project.organizationId !== orgId) {
      throw new ForbiddenError('Access denied to project belonging to another organization');
    }

    return project;
  }

  async createProject(orgId: string, userId: string, input: CreateProjectInput) {
    return prisma.project.create({
      data: {
        organizationId: orgId,
        createdById: userId,
        name: input.name,
        description: input.description
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
  }

  async updateProject(projectId: string, orgId: string, input: UpdateProjectInput) {
    const existing = await this.getProjectById(projectId, orgId);

    return prisma.project.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        description: input.description
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
  }

  async deleteProject(projectId: string, orgId: string) {
    const existing = await this.getProjectById(projectId, orgId);

    // Soft delete
    await prisma.project.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() }
    });

    // Also soft delete underlying tasks
    await prisma.task.updateMany({
      where: {
        projectId: existing.id,
        deletedAt: null
      },
      data: { deletedAt: new Date() }
    });

    return { success: true, message: 'Project deleted successfully' };
  }

  async getProjectDashboard(projectId: string, orgId: string) {
    const project = await this.getProjectById(projectId, orgId);

    const taskCounts = await prisma.task.groupBy({
      by: ['status'],
      where: {
        projectId: project.id,
        deletedAt: null
      },
      _count: {
        id: true
      }
    });

    const statusCounts: Record<string, number> = {
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0
    };

    let totalTasks = 0;
    taskCounts.forEach((tc) => {
      statusCounts[tc.status] = tc._count.id;
      totalTasks += tc._count.id;
    });

    return {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt
      },
      summary: {
        total: totalTasks,
        ...statusCounts
      }
    };
  }
}

export const projectService = new ProjectService();
