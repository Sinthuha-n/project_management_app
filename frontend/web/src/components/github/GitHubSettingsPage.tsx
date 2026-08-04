"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Github, Lock, RefreshCw, Unlock } from 'lucide-react';

import { fetchRepositories } from '../../../services/github-service';
import type { GitHubRepository } from '../../../services/github-service';

const GitHubSettingsPage: React.FC = () => {
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRepositories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRepositories();
      setRepositories(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch repositories';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadRepositories());
  }, [loadRepositories]);

  return (
    <div className="mobile-page-padding w-full max-w-[1100px] mx-auto pb-8 space-y-5">
      <div className="flex flex-col gap-1">
        <div className="inline-flex items-center gap-2 text-[13px] text-cu-text-secondary">
          <Github size={15} className="text-cu-primary" />
          <span className="font-medium">Integrations</span>
        </div>
        <h1 className="font-outfit text-2xl sm:text-[32px] font-bold text-cu-text-primary">
          GitHub Settings
        </h1>
        <p className="text-sm text-cu-text-secondary">
          Review connected repositories and their default branches.
        </p>
      </div>

      <section className="rounded-2xl border border-cu-border bg-cu-bg shadow-cu-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-cu-border bg-cu-bg-secondary/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cu-border bg-cu-bg text-cu-primary shadow-cu-sm">
              <Github size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-cu-text-primary">Connected Repositories</h2>
              <p className="text-xs text-cu-text-secondary">{repositories.length} repositories available</p>
            </div>
          </div>
          {loading && <RefreshCw size={16} className="animate-spin text-cu-text-muted" />}
        </div>

        <div className="p-5">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-16 animate-pulse rounded-xl border border-cu-border bg-cu-bg-secondary" />
              ))}
            </div>
          )}

          {error !== null && (
            <div role="alert" className="rounded-xl border border-cu-danger/20 bg-cu-danger/10 p-4 text-sm text-cu-danger flex items-center justify-between gap-3 flex-wrap">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => void loadRepositories()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cu-danger/20 bg-cu-bg px-3 py-1.5 text-xs font-semibold text-cu-danger hover:bg-cu-danger/10 transition-colors"
              >
                <RefreshCw size={13} />
                Retry
              </button>
            </div>
          )}

          {!loading && error === null && repositories.length === 0 && (
            <div className="rounded-xl border border-dashed border-cu-border bg-cu-bg-secondary p-6 text-center text-sm text-cu-text-muted">
              <p>No repositories found.</p>
              <button
                type="button"
                onClick={() => void loadRepositories()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-cu-primary px-3 py-2 text-xs font-semibold text-white hover:bg-cu-primary-hover transition-colors"
              >
                <RefreshCw size={13} />
                Refresh list
              </button>
            </div>
          )}

          {!loading && error === null && repositories.length > 0 && (
            <ul className="divide-y divide-cu-border rounded-xl border border-cu-border overflow-hidden">
              {repositories.map((repository) => (
                <li key={repository.id} className="flex flex-col gap-2 bg-cu-bg px-4 py-3 hover:bg-cu-hover sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-semibold text-cu-text-primary">
                      {repository.full_name}
                    </strong>
                    <span className="text-xs text-cu-text-muted">Branch: {repository.default_branch}</span>
                  </div>
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-cu-border bg-cu-bg-secondary px-2.5 py-1 text-xs font-semibold text-cu-text-secondary">
                    {repository.private ? <Lock size={12} /> : <Unlock size={12} />}
                    {repository.private ? 'Private' : 'Public'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};

export default GitHubSettingsPage;
