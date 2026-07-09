"use client";
import React, { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import TaskHeader from './TaskHeader';
import TaskMainContent from './TaskMainContent';
import TaskSidebar from './TaskSidebar';
import api from '@/lib/axios';
import { normalizeApiError } from '@/lib/api-error';
import { toast } from '@/components/ui';
import { getProjectGitHubRepo } from '@/services/github-service';
import CreateIssueFromTaskModal from '@/components/github/CreateIssueFromTaskModal';
import { useTaskWebSocket } from '@/hooks/useTaskWebSocket';
import { RouteLoadingState } from '@/components/shared/RouteBoundaryState';

interface TaskData {
  id: number;
  title: string;
  description: string;
  projectId: number;
  projectName: string;
  status: string;
  priority: string;
  storyPoint: number;
  reporterName: string;
  assigneeName: string;
  sprintName: string;
  labels: Array<{ id: number; name: string; color?: string | null }>;
  createdAt: string;
  updatedAt: string;
  dueDate: string;
  subtasks: Array<{ id: number; title: string; status: string }>;
  dependencies: Array<{ id: number; title: string; relation: string }>;
  githubIssueNumber?: number | null;
  githubRepoFullName?: string | null;
  archived?: boolean;
  archivedAt?: string | null;
}

interface TaskCache {
  data: TaskData;
  timestamp: number;
}

// Wrapper component that uses searchParams
function TaskPageContent() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get('taskId');
  
  const [taskData, setTaskData] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showGitHubIssueModal, setShowGitHubIssueModal] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchTaskData = useCallback(async () => {
    if (!taskId) return;
    const cacheKey = `planora:task:${taskId}`;
    // Stale-while-revalidate: show cached data instantly so the modal feels responsive,
    // then overwrite with fresh data once the API responds.
    const cached = localStorage.getItem(cacheKey);
    let cachedLoaded = false;
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as TaskCache;
        const now = Date.now();
        const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
        if (parsed && typeof parsed === 'object' && parsed.data && typeof parsed.timestamp === 'number') {
          if (now - parsed.timestamp < CACHE_TTL_MS) {
            setTaskData(parsed.data);
            setLoading(false);
            cachedLoaded = true;
          } else {
            localStorage.removeItem(cacheKey);
          }
        } else {
          localStorage.removeItem(cacheKey);
        }
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }
    try {
      const response = await api.get(`/api/tasks/${taskId}`);
      setTaskData(response.data);
      localStorage.setItem(cacheKey, JSON.stringify({ data: response.data, timestamp: Date.now() }));
      setError(null);
    } catch (err: unknown) {
      if (!cachedLoaded) {
        setError(normalizeApiError(err, 'Failed to fetch task data'));
        setTaskData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!mounted) return;
    
    if (!taskId) {
      setError('Task ID is required');
      setLoading(false);
      return;
    }

    fetchTaskData();
  }, [taskId, mounted, fetchTaskData]);

  // Listen to planora:task-updated CustomEvent to invalidate cache and refetch
  useEffect(() => {
    if (!mounted || !taskId) return;

    const handleTaskUpdatedEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.taskId) {
        if (String(customEvent.detail.taskId) === String(taskId)) {
          localStorage.removeItem(`planora:task:${taskId}`);
          fetchTaskData();
        }
      } else {
        localStorage.removeItem(`planora:task:${taskId}`);
        fetchTaskData();
      }
    };

    window.addEventListener('planora:task-updated', handleTaskUpdatedEvent);
    return () => {
      window.removeEventListener('planora:task-updated', handleTaskUpdatedEvent);
    };
  }, [mounted, taskId, fetchTaskData]);

  // Listen to WebSocket events to invalidate cache and refetch
  useTaskWebSocket(
    taskData?.projectId ? String(taskData.projectId) : null,
    useCallback((event) => {
      const eventTaskId = event.taskId || event.task?.id;
      if (eventTaskId && String(eventTaskId) === String(taskId)) {
        localStorage.removeItem(`planora:task:${taskId}`);
        fetchTaskData();
      }
    }, [taskId, fetchTaskData])
  );

  const updateTask = async (updates: Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
    storyPoint: number;
    dueDate: string;
  }>) => {
    if (!taskId || !taskData) return;
    
    try {
      await api.put(`/api/tasks/${taskId}`, updates);
      // Invalidate after update so the next page visit fetches fresh data instead of the old snapshot
      localStorage.removeItem(`planora:task:${taskId}`);
      await fetchTaskData();
    } catch (err: unknown) {
      console.error('Failed to update task:', err);
      toast(`Failed to update task: ${normalizeApiError(err, 'Unknown error')}`, 'error');
    }
  };

  const projectGitHubRepo = taskData?.projectId ? getProjectGitHubRepo(taskData.projectId) : null;

  const handleGitHubIssueCreated = (issue: { number: number }) => {
    if (!taskId || !taskData) return;
    const nextTaskData = {
      ...taskData,
      githubIssueNumber: issue.number,
      githubRepoFullName: taskData.githubRepoFullName ?? projectGitHubRepo?.repoFullName ?? null,
    };
    setTaskData(nextTaskData);
    localStorage.setItem(`planora:task:${taskId}`, JSON.stringify({ data: nextTaskData, timestamp: Date.now() }));
  };

  const handleClose = (wasModified?: boolean) => {
    if (wasModified && taskId) {
      localStorage.removeItem(`planora:task:${taskId}`);
    }
    window.history.back();
  };

  // Defer render until after mount so useSearchParams (which is client-only) has resolved
  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-4">
        <div className="w-full max-w-[1200px] bg-white rounded-2xl border border-[#E5E7EB] p-6 space-y-4 shadow-sm">
          <div className="skeleton h-8 w-48 rounded-lg" />
          <div className="skeleton h-5 w-full rounded-lg" />
          <div className="skeleton h-5 w-3/4 rounded-lg" />
          <div className="skeleton h-40 w-full rounded-xl mt-4" />
        </div>
      </div>
    );
  }

  if (error || !taskData) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-[#E5E7EB] shadow-sm max-w-md w-full">
          <h2 className="text-red-600 font-semibold mb-2">Error Loading Task</h2>
          <p className="text-gray-600 mb-4">{error || 'Task not found'}</p>
          <button
            onClick={() => handleClose()}
            className="w-full bg-[#155DFC] text-white py-2 rounded-xl hover:bg-[#0042A8] transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-[1200px] bg-white border border-[#E5E7EB] shadow-2xl flex flex-col font-sans rounded-2xl overflow-hidden" style={{ maxHeight: '94dvh' }}>
        
        {/* 1. Header Component */}
        <TaskHeader 
          project={taskData.projectName} 
          taskId={`TASK-${taskData.id}`} 
          numericTaskId={taskData.id}
          archived={taskData.archived}
          status={taskData.status}
          priority={taskData.priority}
          dueDate={taskData.dueDate}
          onClose={handleClose} 
        />

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
          
          {/* 2. Main Content Component (Left Side) */}
          <TaskMainContent 
              title={taskData.title}
              description={taskData.description}
              subtasks={taskData.subtasks || []}
              dependencies={taskData.dependencies || []}
              taskId={taskData.id}
              projectId={taskData.projectId}
              overview={{
                status: taskData.status,
                priority: taskData.priority,
                dueDate: taskData.dueDate,
                storyPoint: taskData.storyPoint,
                labels: taskData.labels ?? [],
                assignees: taskData.assigneeName ? [{ name: taskData.assigneeName }] : [],
                githubIssueNumber: taskData.githubIssueNumber,
                githubRepoFullName: taskData.githubRepoFullName,
                archived: taskData.archived,
              }}
              onUpdateTitle={(title) => updateTask({ title })}
              onUpdateDescription={(description) => updateTask({ description })}
          />

          {/* 3. Sidebar Component (Right Side) — full width on mobile, fixed on lg+ */}
          <TaskSidebar 
              taskId={taskData.id}
              projectId={taskData.projectId}
              taskTitle={taskData.title}
              taskDescription={taskData.description}
              status={taskData.status}
              assignee={taskData.assigneeName}
              reporter={taskData.reporterName}
              labels={taskData.labels?.map(l => l.name) || []}
              githubIssueNumber={taskData.githubIssueNumber ?? null}
              githubRepoFullName={taskData.githubRepoFullName ?? null}
              projectGitHubRepo={projectGitHubRepo}
              priority={taskData.priority}
              sprint={taskData.sprintName}
              storyPoint={taskData.storyPoint}
              dates={{
                  created: taskData.createdAt,
                  updated: taskData.updatedAt,
                  dueDate: taskData.dueDate
              }}
              onUpdateStatus={(status) => updateTask({ status })}
              onUpdatePriority={(priority) => updateTask({ priority })}
              onUpdateStoryPoint={(storyPoint) => updateTask({ storyPoint })}
              onCreateGitHubIssue={() => setShowGitHubIssueModal(true)}
          />

          {showGitHubIssueModal && projectGitHubRepo && (
            <CreateIssueFromTaskModal
              open={showGitHubIssueModal}
              taskId={taskData.id}
              taskTitle={taskData.title}
              taskDescription={taskData.description}
              taskLabels={taskData.labels?.map((label) => label.name) || []}
              repoFullName={projectGitHubRepo.repoFullName}
              onClose={() => setShowGitHubIssueModal(false)}
              onCreated={handleGitHubIssueCreated}
            />
          )}

        </div>
      </div>
    </div>
  );
}

export default function TaskPage() {
  return (
    <Suspense fallback={<RouteLoadingState title="Loading task" subtitle="Preparing task details." variant="detail" />}>
      <TaskPageContent />
    </Suspense>
  );
}
