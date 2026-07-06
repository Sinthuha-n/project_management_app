'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Flag, Loader2, Plus, RefreshCw } from 'lucide-react';
import { getMilestones, createMilestone, updateMilestone, deleteMilestone } from '@/services/milestone-service';
import type { MilestoneResponse } from '@/types';
import { type MilestoneStatus } from './components/milestoneConfig';
import MilestoneCard from './components/MilestoneCard';
import MilestoneForm from './components/MilestoneForm';
import EmptyState from '@/components/shared/EmptyState';
import { RouteLoadingState } from '@/components/shared/RouteBoundaryState';

function MilestonesPageContent() {
  const searchParams = useSearchParams();
  const projectIdStr = searchParams.get('projectId');
  const projectId = projectIdStr ? Number(projectIdStr) : null;

  const [milestones, setMilestones] = useState<MilestoneResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<MilestoneResponse | null>(null);

  const cacheKey = projectId ? `planora:milestones:${projectId}` : null;

  const loadMilestones = useCallback(async () => {
    if (!projectId || !cacheKey) return;
    // Stale-while-revalidate: show cached data instantly so the list doesn't flicker on every open
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setMilestones(JSON.parse(cached) as MilestoneResponse[]);
        setLoading(false);
      } catch { /* ignore corrupt cache */ }
    }
    // Always revalidate so the list reflects any changes made from other sessions
    try {
      const data = await getMilestones(projectId);
      setMilestones(data);
      localStorage.setItem(cacheKey, JSON.stringify(data));
      setError(null);
    } catch {
      if (!cached) setError('Failed to load milestones');
    } finally {
      setLoading(false);
    }
  }, [projectId, cacheKey]);

  useEffect(() => { void loadMilestones(); }, [loadMilestones]);

  // Debounced cache write: coalesces rapid milestone state changes into a single localStorage write
  useEffect(() => {
    if (!cacheKey || milestones.length === 0) return;
    const id = setTimeout(() => {
      localStorage.setItem(cacheKey, JSON.stringify(milestones));
    }, 500);
    return () => clearTimeout(id);
  }, [milestones, cacheKey]);

  const invalidateCache = useCallback(() => {
    if (cacheKey) localStorage.removeItem(cacheKey);
  }, [cacheKey]);

  const handleCreate = async (data: { name: string; description: string; dueDate: string; status: MilestoneStatus }) => {
    if (!projectId) return;
    try {
      const created = await createMilestone(projectId, {
        name: data.name,
        description: data.description || undefined,
        dueDate: data.dueDate || undefined,
        status: data.status,
      });
      setMilestones((prev) => [created, ...prev]);
      setShowCreate(false);
    } catch {
      setError('Failed to create milestone');
    }
  };

  const handleUpdate = async (data: { name: string; description: string; dueDate: string; status: MilestoneStatus }) => {
    if (!editing) return;
    try {
      const updated = await updateMilestone(editing.id, {
        name: data.name,
        description: data.description || undefined,
        dueDate: data.dueDate || undefined,
        status: data.status,
      });
      setMilestones((prev) => prev.map((m) => m.id === updated.id ? updated : m));
      setEditing(null);
    } catch {
      setError('Failed to update milestone');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this milestone? Tasks will not be deleted.')) return;
    try {
      await deleteMilestone(id);
      setMilestones((prev) => prev.filter((m) => m.id !== id));
    } catch {
      setError('Failed to delete milestone');
    }
  };

  const handleStatusChange = async (id: number, status: MilestoneStatus) => {
    const m = milestones.find((x) => x.id === id);
    if (!m) return;
    // Optimistic update so the badge flips immediately without a loading spinner
    setMilestones((prev) => prev.map((x) => x.id === id ? { ...x, status } : x));
    try {
      await updateMilestone(id, { name: m.name, status });
    } catch {
      // On failure, bust the cache and reload so the UI reflects true server state rather than staying wrong
      invalidateCache();
      void loadMilestones();
    }
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800">Missing Project ID</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-gray-50 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Flag size={18} className="text-purple-500" /> Milestones
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Track major goals and checkpoints for this project</p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setEditing(null); }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 min-h-[44px] rounded-lg shadow-sm transition-colors"
          >
            <Plus size={14} /> New Milestone
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center gap-2"><AlertCircle size={15} /> {error}</span>
            <button
              type="button"
              onClick={() => void loadMilestones()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
            >
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <div className="mb-4">
            <MilestoneForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : milestones.length === 0 && !showCreate ? (
          <EmptyState
            icon={<Flag size={28} />}
            title="No milestones yet"
            subtitle="Create one to track major goals and checkpoints for this project."
            action={
              <button
                type="button"
                onClick={() => { setShowCreate(true); setEditing(null); }}
                className="inline-flex items-center gap-2 rounded-xl bg-cu-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-cu-primary-hover transition-colors"
              >
                <Plus size={14} />
                New Milestone
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {milestones.map((m) =>
              editing?.id === m.id ? (
                <MilestoneForm
                  key={m.id}
                  initial={m}
                  onSubmit={handleUpdate}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <MilestoneCard
                  key={m.id}
                  milestone={m}
                  onEdit={setEditing}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MilestonesPage() {
  return (
    <Suspense fallback={<RouteLoadingState title="Loading milestones" subtitle="Preparing project milestones." variant="cards" />}>
      <MilestonesPageContent />
    </Suspense>
  );
}
