'use client';

import React, { Suspense, useCallback, useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import axios from '@/lib/axios';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import { useTaskWebSocket } from '@/hooks/useTaskWebSocket';
import { buildSessionCacheKey, getSessionCache, setSessionCache } from '@/lib/session-cache';
import SprintBoardHeader from './components/SprintBoardHeader';
import SprintColumn from './components/SprintColumn';
import SprintDragDropProvider from './components/SprintDragDropProvider';
import CreateColumnModal from './components/CreateColumnModal';
import BoardEmptyStates from './components/BoardEmptyStates';
import CompleteSprintModal from './components/CompleteSprintModal';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import BulkSelectionBar from './components/BulkSelectionBar';
import InlineColumnCreator from './components/InlineColumnCreator';
import { RouteLoadingState } from '@/components/shared/RouteBoundaryState';
import UndoMoveToast from './components/UndoMoveToast';
import {
  fetchSprintboardBySprintId,
  fetchSprintboardBySprintIdFull,
  fetchSprintsByProject,
  fetchTeamMembers,
} from './api';
import type { SprintboardFullResponse } from './types';
import { useSprintBoardStore } from './hooks/useSprintBoardStore';
import { useSprintBoardActions } from './hooks/useSprintBoardActions';
import { useVisibilityInterval } from '@/hooks/useVisibilityInterval';

type SprintSummary = { id: number; status: string; sprintName?: string };
type SprintBoardCache = { activeList: SprintSummary[]; boards: SprintboardFullResponse[] };

function SprintBoardPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectIdStr = searchParams.get('projectId');

  // Synchronously determine initial selected index and dense mode from URL search params
  const [selectedIdx, setSelectedIdx] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const tab = new URLSearchParams(window.location.search).get('sprintTab');
    return tab ? parseInt(tab, 10) || 0 : 0;
  });
  const [denseMode, setDenseMode] = useState(() => {
    if (typeof window === 'undefined') return true;
    const dense = new URLSearchParams(window.location.search).get('dense');
    return dense !== '0';
  });

  // Load initial project info synchronously from session cache to prevent loading flicker
  const cachedProjectInfo = useMemo(() => {
    if (typeof window === 'undefined' || !projectIdStr) return null;
    const cKey = buildSessionCacheKey('sprint-board-project-info', [projectIdStr]);
    if (!cKey) return null;
    return getSessionCache<{ isAgile: boolean; teamId: number | null; projectKey: string }>(cKey).data;
  }, [projectIdStr]);

  const [isAgile, setIsAgile] = useState<boolean | null>(() => cachedProjectInfo?.isAgile ?? null);
  const [projectKey, setProjectKey] = useState<string>(() => cachedProjectInfo?.projectKey ?? '');
  const [teamId, setTeamId] = useState<number | null>(() => cachedProjectInfo?.teamId ?? null);

  // Synchronously compute initial filters matching searchParams
  const initialFilters = useMemo(() => {
    if (typeof window === 'undefined') return {};
    const params = new URLSearchParams(window.location.search);
    const rawSwimlane = params.get('swimlane');
    const swimlane: 'none' | 'assignee' | 'priority' = (rawSwimlane === 'assignee' || rawSwimlane === 'priority') ? rawSwimlane : 'none';
    return {
      search: params.get('q') ?? '',
      swimlane,
    };
  }, []);

  const { board, hydrate, filters, updateFilters, filteredColumns, swimlanes, collapsedColumns, toggleColumnCollapsed, selectedTaskIds, toggleTaskSelected, clearSelection, applyOptimisticMove, rollbackMove, lastMove, metrics } = useSprintBoardStore(initialFilters);

  const [allBoards, setAllBoards] = useState<SprintboardFullResponse[]>([]);
  const [allActiveSprints, setAllActiveSprints] = useState<SprintSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  // Synchronously initialize team members from session cache if available
  const [teamMembers, setTeamMembers] = useState<import('./api').SprintTeamMemberOption[]>(() => {
    if (typeof window === 'undefined' || !teamId) return [];
    const cKey = buildSessionCacheKey('sprint-board-team-members', [teamId]);
    if (cKey) {
      const cached = getSessionCache<import('./api').SprintTeamMemberOption[]>(cKey);
      if (cached.data) return cached.data;
    }
    return [];
  });

  const sprintboard = allBoards[selectedIdx] ?? null;
  const activeSprint = allActiveSprints[selectedIdx] ?? null;

  // ── Fetch project info ─────────────────────────────────────────────────────
  const fetchProjectInfo = useCallback(async () => {
    if (!projectIdStr) return;
    const cKey = buildSessionCacheKey('sprint-board-project-info', [projectIdStr]);
    try {
      const res = await axios.get(`/api/projects/${projectIdStr}`);
      const agile = res.data.type === 'AGILE' || res.data.type === 'Agile Scrum' || res.data.type === 'SCRUM';
      const tId = Number(res.data.teamId ?? res.data.team?.id ?? 0) || null;
      const pKey = res.data.projectKey ?? '';
      
      setIsAgile(agile);
      setTeamId(tId);
      setProjectKey(pKey);
      
      if (cKey) {
        setSessionCache(cKey, { isAgile: agile, teamId: tId, projectKey: pKey }, 30 * 60_000);
      }
    } catch { 
      setIsAgile(false); 
    }
  }, [projectIdStr]);

  // Synchronously cache and load team members list by teamId
  useEffect(() => {
    if (!teamId) return;
    const cKey = buildSessionCacheKey('sprint-board-team-members', [teamId]);
    let hasCache = false;
    if (cKey) {
      const cached = getSessionCache<import('./api').SprintTeamMemberOption[]>(cKey);
      if (cached.data) {
        queueMicrotask(() => setTeamMembers(cached.data!));
        hasCache = true;
      }
    }
    void fetchTeamMembers(teamId).then((members) => {
      setTeamMembers(members);
      if (cKey) {
        setSessionCache(cKey, members, 15 * 60_000);
      }
    }).catch(() => {
      if (!hasCache) setTeamMembers([]);
    });
  }, [teamId]);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async (options: { showSpinner?: boolean; forceNetwork?: boolean } = {}) => {
    if (!projectIdStr) return;
    const { showSpinner = true, forceNetwork = false } = options;
    const pid = parseInt(projectIdStr, 10);
    const cKey = buildSessionCacheKey('sprint-board-v2', [projectIdStr]);
    
    let hasCache = false;
    if (cKey && !forceNetwork) {
      const cached = getSessionCache<SprintBoardCache>(cKey, { allowStale: true });
      if (cached.data) {
        setAllActiveSprints(cached.data.activeList); 
        setAllBoards(cached.data.boards);
        hydrate(cached.data.boards[selectedIdx] ?? cached.data.boards[0] ?? null);
        setLoading(false);
        hasCache = true;
        if (!cached.isStale) return;
      }
    }
    
    if (!hasCache && showSpinner) {
      setLoading(true);
    }
    setError(null);
    try {
      const sprints = await fetchSprintsByProject(pid) as Array<SprintSummary & { name?: string }>;
      const activeList = sprints.filter((s) => s.status === 'ACTIVE').map((s) => ({ ...s, sprintName: s.sprintName || s.name || `Sprint #${s.id}` }));
      if (activeList.length === 0) { 
        setAllActiveSprints([]); 
        setAllBoards([]); 
        hydrate(null); 
        setLoading(false); 
        if (cKey) setSessionCache(cKey, { activeList: [], boards: [] }, 30 * 60_000);
        return; 
      }
      const boards = await Promise.all(
        activeList.map(async (sprint) => {
          try { return await fetchSprintboardBySprintIdFull(sprint.id); }
          catch {
            const legacy = await fetchSprintboardBySprintId(sprint.id);
            return { ...legacy, stats: { totalTasks: legacy.columns.reduce((sum, col) => sum + col.tasks.length, 0), doneTasks: legacy.columns.find((col) => col.columnStatus === 'DONE')?.tasks.length ?? 0, totalStoryPoints: legacy.columns.flatMap((col) => col.tasks).reduce((sum, task) => sum + (task.storyPoint ?? 0), 0), doneStoryPoints: 0, overdueTasks: 0, unassignedTasks: 0 } } as SprintboardFullResponse;
          }
        }),
      );
      setAllActiveSprints(activeList); 
      setAllBoards(boards);
      const safeIdx = selectedIdx >= activeList.length ? 0 : selectedIdx;
      if (safeIdx !== selectedIdx) setSelectedIdx(safeIdx);
      hydrate(boards[safeIdx] ?? boards[0] ?? null);
      if (cKey) setSessionCache(cKey, { activeList, boards }, 30 * 60_000);
    } catch { 
      if (!hasCache) setError('Failed to load sprint board.'); 
    } finally { 
      setLoading(false); 
    }
  }, [projectIdStr, selectedIdx, hydrate]);

  const forceRefresh = useCallback(() => void fetchData({ showSpinner: false, forceNetwork: true }), [fetchData]);

  // Synchronize state values from query parameters on outer parameter changes (e.g. forward/back navigation)
  useEffect(() => {
    if (!projectIdStr) return;
    
    // Sync project info if cached
    const cKey = buildSessionCacheKey('sprint-board-project-info', [projectIdStr]);
    if (cKey) {
      const cached = getSessionCache<{ isAgile: boolean; teamId: number | null; projectKey: string }>(cKey);
      if (cached.data) {
        queueMicrotask(() => {
          setIsAgile(cached.data!.isAgile);
          setTeamId(cached.data!.teamId);
          setProjectKey(cached.data!.projectKey);
        });
      }
    }

    const params = new URLSearchParams(window.location.search);
    const q = params.get('q') ?? '';
    const rawSwimlane = params.get('swimlane');
    const swimlane: 'none' | 'assignee' | 'priority' = (rawSwimlane === 'assignee' || rawSwimlane === 'priority') ? rawSwimlane : 'none';
    const tab = params.get('sprintTab');
    const dense = params.get('dense');
    queueMicrotask(() => {
      updateFilters({ search: q, swimlane });
      setSelectedIdx(tab ? parseInt(tab, 10) || 0 : 0);
      setDenseMode(dense !== '0');
    });
  }, [projectIdStr, searchParams, updateFilters]);

  useEffect(() => { 
    if (!projectIdStr) return; 
    queueMicrotask(() => {
      void fetchProjectInfo();
      void fetchData({ showSpinner: true });
    });
  }, [projectIdStr, fetchProjectInfo, fetchData]);

  useVisibilityInterval(() => void fetchData({ showSpinner: false }), 30_000, Boolean(projectIdStr));

  useEffect(() => { 
    const onTaskUpdated = () => void fetchData({ showSpinner: false, forceNetwork: true }); 
    window.addEventListener('planora:task-updated', onTaskUpdated); 
    return () => window.removeEventListener('planora:task-updated', onTaskUpdated); 
  }, [fetchData]);

  useTaskWebSocket(projectIdStr, () => { void fetchData({ showSpinner: false, forceNetwork: true }); });
  useEffect(() => { hydrate(sprintboard ?? null); }, [sprintboard, hydrate]);

  // ── Actions hook ───────────────────────────────────────────────────────────
  const actions = useSprintBoardActions({ projectIdStr, allBoards, allActiveSprints, setAllBoards, selectedIdx, activeSprint, sprintboard, board, teamMembers, forceRefresh, applyOptimisticMove, rollbackMove, selectedTaskIds, clearSelection });

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setShowShortcuts((prev) => !prev); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') { event.preventDefault(); setDenseMode((prev) => !prev); }
      else if (event.key === 'Escape') setShowShortcuts(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── URL sync ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectIdStr || !router || typeof (router as { replace?: unknown }).replace !== 'function') return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('projectId', projectIdStr);
    if (filters.search) params.set('q', filters.search); else params.delete('q');
    params.set('swimlane', filters.swimlane); params.set('dense', denseMode ? '1' : '0'); params.set('sprintTab', String(selectedIdx));
    const nextQuery = params.toString();
    if (nextQuery === searchParams.toString()) return;
    router.replace(`?${nextQuery}`, { scroll: false });
  }, [filters.search, filters.swimlane, denseMode, selectedIdx, projectIdStr, router, searchParams]);

  // ── Early returns ──────────────────────────────────────────────────────────
  if (!projectIdStr) return <BoardEmptyStates type="missing-project" />;
  if (isAgile === null) return <BoardEmptyStates type="loading-agile" />;
  if (!isAgile) return <BoardEmptyStates type="not-agile" />;

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-cu-bg-secondary overflow-hidden">
      {loading ? <BoardEmptyStates type="loading" /> :
       error ? <BoardEmptyStates type="error" error={error} onRetry={forceRefresh} /> :
       !sprintboard || !board ? <BoardEmptyStates type="no-sprint" onGoToBacklog={() => router.push(`/sprint-backlog?projectId=${projectIdStr}`)} /> : (
        <>
          <SprintBoardHeader
            sprintName={activeSprint?.sprintName || sprintboard.sprintName}
            allActiveSprints={allActiveSprints} selectedIdx={selectedIdx} onSelectSprint={setSelectedIdx}
            filters={filters} onSearchChange={(val) => updateFilters({ search: val })} onFilterChange={updateFilters}
            onCompleteSprint={() => activeSprint && void actions.openCompleteModal(activeSprint.id)}
            totalTasks={metrics.totalTasks} doneTasks={metrics.doneTasks} doneStoryPoints={metrics.doneStoryPoints}
            totalStoryPoints={metrics.totalStoryPoints} overdueTasks={metrics.overdueTasks} selectedCount={metrics.selectedCount}
            isLoading={actions.isUpdating} onOpenShortcuts={() => setShowShortcuts(true)}
            teamMembers={teamMembers}
          />
          <div className="px-4 md:px-6 py-1 border-b border-cu-border bg-cu-bg">
            <button type="button" onClick={() => setDenseMode((prev) => !prev)} className="rounded-lg border border-cu-border bg-cu-bg-secondary px-2 py-1 text-xs text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary transition-colors">
              {denseMode ? 'Switch to comfort spacing' : 'Switch to dense spacing'}
            </button>
          </div>

          <BulkSelectionBar count={selectedTaskIds.size} isBulkApplying={actions.isBulkApplying} onBulkStatus={actions.handleBulkStatus} onBulkDelete={actions.handleBulkDelete} onClear={clearSelection} />
          <KeyboardShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />

          <div className="flex-1 overflow-x-auto px-3 md:px-5 py-3 snap-x snap-mandatory hide-scrollbar">
            <UndoMoveToast lastMove={lastMove} onUndo={actions.handleUndoMove} />
            <CompleteSprintModal
              open={actions.showCompleteConfirm}
              allActiveSprints={allActiveSprints}
              sprintIdToComplete={actions.sprintIdToComplete}
              onSelectSprint={actions.setSprintIdToComplete}
              incompleteCount={actions.incompleteCount}
              availableDestSprints={actions.availableDestSprints}
              destination={actions.completeDestination}
              onSelectDestination={actions.setCompleteDestination}
              onComplete={actions.handleCompleteSprint}
              onCancel={() => actions.setShowCompleteConfirm(false)}
              isLoading={actions.isUpdating}
            />
            {actions.successMsg && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-2 text-sm font-semibold text-emerald-500 shadow-cu-lg">{actions.successMsg}</div>}

            <SprintDragDropProvider
              tasks={board.columns.flatMap((col) => col.tasks)}
              columns={board.columns}
              onDragEnd={actions.handleDragEnd}
            >
              <div className="flex items-start gap-4 sm:gap-3 h-full min-h-[calc(100vh-250px)] pb-3">
                {(swimlanes ?? [{ key: 'default', columns: filteredColumns }]).map((lane) => (
                  <div key={lane.key} className="space-y-2">
                    {swimlanes && <div className="rounded-lg border border-cu-border bg-cu-bg px-3 py-1 text-xs font-semibold text-cu-text-secondary shadow-cu-sm">{lane.key}</div>}
                    <SortableContext items={lane.columns.map((column) => `column-${column.id}`)} strategy={horizontalListSortingStrategy}>
                      <div className="flex items-start gap-3">
                        {lane.columns.map((column) => (
                          <SprintColumn
                            key={`${lane.key}-${column.id}`}
                            column={column}
                            dense={denseMode}
                            compactEmpty
                            collapsed={!!collapsedColumns[column.columnStatus]}
                            onToggleCollapsed={toggleColumnCollapsed}
                            selectedTaskIds={selectedTaskIds}
                            onToggleTaskSelected={toggleTaskSelected}
                            onInlineCreate={actions.handleInlineCreateTask}
                            onOpenTask={(id) => setSelectedTaskId(id)}
                            onUpdateTaskDueDate={actions.handleInlineDueDateChange}
                            onAssignTaskSingle={actions.handleInlineAssignSingle}
                            onAssignTaskMultiple={actions.handleInlineAssignMultiple}
                            onRenameTask={actions.handleRenameTask}
                            onDeleteTask={actions.handleDeleteTask}
                            onRenameColumn={actions.handleRenameColumn}
                            onChangeColumnColor={actions.handleChangeColumnColor}
                            onDeleteColumn={actions.handleDeleteColumn}
                            teamMembers={teamMembers}
                            projectKey={projectKey}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </div>
                ))}
                <div className="flex flex-col flex-shrink-0 h-full min-h-[420px] self-start snap-center md:snap-none" style={{ width: 280 }}>
                  <InlineColumnCreator isAddingColumn={actions.isAddingColumn} newColumnName={actions.newColumnName} isCreatingColumn={actions.isCreatingColumn}
                    onNewColumnNameChange={actions.setNewColumnName} onStartAdding={() => actions.setIsAddingColumn(true)}
                    onFinalize={actions.finalizeAddColumn} onCancel={() => { actions.setIsAddingColumn(false); actions.setNewColumnName(''); }} />
                </div>
              </div>
            </SprintDragDropProvider>
          </div>
          <CreateColumnModal isOpen={isColumnModalOpen} onClose={() => setIsColumnModalOpen(false)} onCreateColumn={actions.finalizeAddColumn} loading={actions.isCreatingColumn} />
          {selectedTaskId !== null && (
            <TaskCardModal taskId={selectedTaskId} onClose={(modified) => { setSelectedTaskId(null); if (modified) window.dispatchEvent(new CustomEvent('planora:task-updated')); }} />
          )}
        </>
      )}
    </div>
  );
}

export default function SprintBoardPage() {
  return (
    <Suspense fallback={<RouteLoadingState title="Loading sprint board" subtitle="Preparing sprint columns and tasks." variant="board" />}>
      <SprintBoardPageContent />
    </Suspense>
  );
}
