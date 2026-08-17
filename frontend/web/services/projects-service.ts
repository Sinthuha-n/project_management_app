import { projectsApi, documentsApi } from './api-contract';
import type { ProjectSummary } from './api-contract';
import type { ProjectMetrics } from '@/types';

export type { ProjectSummary };

export async function fetchAllProjects(): Promise<ProjectSummary[]> {
  return projectsApi.list();
}

export async function fetchRecentProjects(limit = 10): Promise<ProjectSummary[]> {
  return projectsApi.getRecent(limit);
}

export async function fetchFavoriteProjects(): Promise<ProjectSummary[]> {
  return projectsApi.getFavorites();
}

export async function fetchProjectDetails(projectId: string): Promise<ProjectSummary> {
  return projectsApi.get(projectId);
}

export async function fetchProjectMetrics(projectId: string | number): Promise<ProjectMetrics> {
  return projectsApi.getMetrics(projectId);
}

export async function recordProjectAccess(projectId: number): Promise<void> {
  return projectsApi.recordAccess(projectId);
}

export async function toggleFavorite(projectId: number | string): Promise<void> {
  return projectsApi.toggleFavorite(projectId);
}

export async function updateProjectDetails(projectId: number | string, data: { name?: string; description?: string; figmaUrl?: string | null }): Promise<ProjectSummary> {
  return projectsApi.update(projectId, data);
}

export async function deleteProject(projectId: number | string, teamId: number | string): Promise<void> {
  return projectsApi.delete(projectId, teamId);
}

export async function leaveProject(projectId: number | string): Promise<void> {
  return projectsApi.leave(projectId);
}

export async function fetchDocuments(
  projectId: string,
  includeDeleted = false,
): Promise<unknown[]> {
  return documentsApi.listByProject(projectId, includeDeleted);
}
