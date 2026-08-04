'use client';

import React, { useState, useEffect } from 'react';
import { Edit3, Check, Loader2 } from 'lucide-react';
import { updateProjectDetails } from '@/services/projects-service';
import useSWR, { mutate } from 'swr';
import { toast } from '@/components/ui/Toast';
import api from '@/lib/axios';
import { motion } from 'framer-motion';

const DELIMITER = '|||AUTHOR:';

function parseNote(raw: string) {
  if (!raw) return { text: '', author: '' };
  const parts = raw.split(DELIMITER);
  if (parts.length >= 2) return { text: parts[0], author: parts[1] };
  return { text: raw, author: '' };
}

function serializeNote(text: string, author: string) {
  return author ? text + DELIMITER + author : text;
}

/**
 * A collaborative note widget for the project summary.
 * Allows members to jot down and persist project-wide descriptions or rules.
 */
export function ProjectNote({ projectId, defaultNote = '' }: { projectId: number | string; defaultNote?: string }) {
  const parsedDefault = parseNote(defaultNote);
  const [isEditing, setIsEditing] = useState(false);
  const [note, setNote] = useState(parsedDefault.text);
  const [isSaving, setIsSaving] = useState(false);

  const { data: currentUser } = useSWR('/api/user/me', (url) => api.get(url).then(res => res.data));
  const authorName = currentUser?.fullName || currentUser?.username || 'Team Member';

  useEffect(() => {
    if (!isEditing) queueMicrotask(() => setNote(parseNote(defaultNote).text));
  }, [defaultNote, isEditing]);

  const handleSave = async () => {
    if (note === parsedDefault.text) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await updateProjectDetails(projectId, { description: serializeNote(note, authorName) });
      mutate(`/api/projects/${projectId}`);
      setIsEditing(false);
      toast('Project note updated', 'success');
    } catch {
      toast('Failed to update project note', 'error');
      setNote(parsedDefault.text);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full w-full relative overflow-hidden">
      <div className="flex-1 p-0 relative w-full h-full overflow-hidden">
        {/* Floating Controls */}
        <div className="absolute top-2 right-3 z-10 flex items-center gap-2">
          {!isEditing && parsedDefault.author && (
            <span className="text-[10px] text-cu-text-muted italic hidden sm:block">
              Last edited by <span className="font-semibold text-cu-text-secondary">{parsedDefault.author}</span>
            </span>
          )}
          <button
            onClick={isEditing ? handleSave : () => setIsEditing(true)}
            disabled={isSaving}
            className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-md border shadow-cu-sm transition-all ${isEditing ? 'bg-cu-warning/10 text-cu-warning border-cu-warning/20' : 'bg-cu-bg-secondary text-cu-text-secondary border-cu-border hover:bg-cu-hover hover:text-cu-text-primary'}`}
          >
            {isEditing ? (isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />) : <Edit3 size={12} />}
            {isEditing ? (isSaving ? 'Saving...' : 'Save') : 'Edit'}
          </button>
        </div>

        {isEditing ? (
          <textarea
            autoFocus
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Jot down important rules, goals, or notes for this project..."
            className="absolute inset-0 w-full h-full px-4 pt-11 pb-4 resize-none bg-cu-warning/5 text-[13px] font-arimo text-cu-text-primary placeholder:text-cu-text-muted focus:outline-none focus:ring-2 focus:ring-cu-warning/20 border-none transition-all custom-scrollbar"
          />
        ) : (
          <div
            className="absolute inset-0 w-full h-full px-4 pt-11 pb-4 overflow-y-auto text-[13px] font-arimo text-cu-text-primary whitespace-pre-wrap cursor-text hover:bg-cu-hover transition-colors custom-scrollbar"
            onClick={() => setIsEditing(true)}
          >
            {note || <span className="text-cu-text-muted italic">Click to write a shared project note or summary...</span>}
          </div>
        )}
      </div>
    </motion.div>
  );
}
