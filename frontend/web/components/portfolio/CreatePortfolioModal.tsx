'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { portfolioService, type Portfolio } from '@/services/portfolioService';
import { fetchAllProjects, type ProjectSummary } from '@/services/projects-service';
import OverlayPortal from '@/components/ui/OverlayPortal';

const COLORS = ['#155DFC','#0C4DDA','#4299E1','#6BC950','#FF9F43','#FF5C5C','#8B5CF6','#EC4899'];
const EMOJIS = ['📁','🚀','💼','⚡','🎯','💡','🌟','🔥','🏆','📊'];

interface Props {
  onClose: () => void;
  onCreated: (p: Portfolio) => void;
}

export default function CreatePortfolioModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [emoji, setEmoji] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Project selection
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [showProjects, setShowProjects] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setProjectsLoading(true);
      void fetchAllProjects()
        .then(setProjects)
        .catch(() => {})
        .finally(() => setProjectsLoading(false));
    });
  }, []);

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const toggleProject = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const submit = async () => {
    if (!name.trim()) { setError('Portfolio name is required'); return; }
    setLoading(true);
    setError('');
    try {
      const p = await portfolioService.create({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        emoji: emoji || undefined,
        projectIds: selectedIds.length > 0 ? selectedIds : undefined,
      });
      onCreated(p);
    } catch {
      setError('Failed to create portfolio. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OverlayPortal>
      <AnimatePresence>
      <motion.div className="fixed inset-0 z-[var(--cu-z-modal)] flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

        <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />

        <motion.div
          className="relative w-full max-w-md bg-cu-bg rounded-2xl shadow-cu-xl border border-cu-border overflow-hidden z-10 max-h-[90vh] flex flex-col"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}>

          <div className="h-1 flex-shrink-0" style={{ background: color }} />

          <div className="overflow-y-auto flex-1 p-6">
            <h2 className="text-cu-text-primary text-base font-semibold mb-5">New Portfolio</h2>

            {/* Emoji picker */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(emoji === e ? '' : e)}
                  className={`w-9 h-9 rounded-lg text-lg transition-all border ${
                    emoji === e
                      ? 'border-cu-primary bg-cu-primary/10 scale-110'
                      : 'border-cu-border bg-cu-bg-secondary opacity-70 hover:opacity-100'
                  }`}>
                  {e}
                </button>
              ))}
            </div>

            {/* Name */}
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="Portfolio name *"
              className="w-full rounded-xl px-4 py-2.5 text-sm text-cu-text-primary placeholder-cu-text-muted mb-3 outline-none transition-colors bg-cu-bg-secondary border border-cu-border focus:border-cu-primary focus:ring-2 focus:ring-cu-primary/15"
            />

            {/* Description */}
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full rounded-xl px-4 py-2.5 text-sm text-cu-text-primary placeholder-cu-text-muted mb-4 outline-none resize-none bg-cu-bg-secondary border border-cu-border focus:border-cu-primary focus:ring-2 focus:ring-cu-primary/15"
            />

            {/* Color picker */}
            <div className="mb-5">
              <p className="text-cu-text-muted text-xs mb-2">Accent color</p>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full transition-all border-2 ${
                      color === c ? 'scale-125 border-white' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-110'
                    }`}
                    style={{ background: c, boxShadow: color === c ? `0 0 0 2px ${c}60` : undefined }} />
                ))}
              </div>
            </div>

            {/* Projects section */}
            <div className="border border-cu-border rounded-xl overflow-hidden mb-4">
              <button
                onClick={() => setShowProjects(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-cu-text-primary font-medium hover:bg-cu-hover transition-colors">
                <span className="flex items-center gap-2">
                  <span>Add projects</span>
                  {selectedIds.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                      style={{ background: color }}>
                      {selectedIds.length}
                    </span>
                  )}
                </span>
                <span className={`text-cu-text-muted text-xs transition-transform ${showProjects ? 'rotate-180' : ''}`}>▼</span>
              </button>

              <AnimatePresence>
                {showProjects && (
                  <motion.div
                    initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                    transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                    <div className="border-t border-cu-border">
                      <div className="px-3 py-2">
                        <input
                          value={projectSearch}
                          onChange={e => setProjectSearch(e.target.value)}
                          placeholder="Search projects..."
                          className="w-full rounded-lg px-3 py-1.5 text-xs text-cu-text-primary placeholder-cu-text-muted outline-none bg-cu-bg-secondary border border-cu-border focus:border-cu-primary"
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {projectsLoading ? (
                          <p className="text-center text-cu-text-muted text-xs py-4">Loading…</p>
                        ) : filteredProjects.length === 0 ? (
                          <p className="text-center text-cu-text-muted text-xs py-4">No projects found</p>
                        ) : filteredProjects.map(p => {
                          const selected = selectedIds.includes(p.id);
                          return (
                            <button key={p.id} onClick={() => toggleProject(p.id)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-cu-hover transition-colors">
                              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                                selected ? 'border-transparent' : 'border-cu-border'
                              }`} style={selected ? { background: color } : {}}>
                                {selected && <span className="text-white text-[10px] font-bold">✓</span>}
                              </div>
                              <div className="min-w-0 flex-1 text-left">
                                <p className="text-cu-text-primary text-xs font-medium truncate">{p.name}</p>
                                {p.projectKey && (
                                  <p className="text-cu-text-muted text-[10px]">{p.projectKey}</p>
                                )}
                              </div>
                              <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold"
                                style={{
                                  background: p.type === 'AGILE' ? 'var(--cu-primary-light)' : 'var(--cu-success-light)',
                                  color:      p.type === 'AGILE' ? 'var(--cu-primary)' : 'var(--cu-success)',
                                }}>
                                {p.type === 'AGILE' ? 'Sprint' : 'Kanban'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {error && <p className="text-cu-danger text-xs mb-3">{error}</p>}
          </div>

          {/* Actions — always visible at bottom */}
          <div className="px-6 pb-6 pt-2 flex-shrink-0 flex gap-2.5 border-t border-cu-border">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm text-cu-text-secondary font-medium transition-all hover:bg-cu-hover border border-cu-border">
              Cancel
            </button>
            <button onClick={submit} disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm text-white font-semibold transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: color }}>
              {loading ? 'Creating…' : `Create${selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}`}
            </button>
          </div>
        </motion.div>
      </motion.div>
      </AnimatePresence>
    </OverlayPortal>
  );
}
