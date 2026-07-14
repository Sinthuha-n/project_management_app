'use client';

import React, { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Trash2, Calendar, ClipboardList, RefreshCw, PenTool, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { fetchAssignedTasks } from '@/services/dashboard-service';
import { fetchNotifications, markNotificationRead } from '@/services/notifications-service';
import type { RawTask } from '@/app/dashboard/components/table/types';
import type { NotificationDto as Notification } from '@/services/system-contract';
import { formatDateTime } from '@/lib/date-time';

// Helper types
interface FocusItem {
  id: string;
  text: string;
  completed: boolean;
}

export default function PersonalHub({ userId }: { userId?: string }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // --- SWR Data Fetching ---
  const { data: assignedTasks, mutate: mutateTasks } = useSWR<RawTask[]>(
    'dashboard:assigned-tasks',
    () => fetchAssignedTasks() as Promise<RawTask[]>,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const { data: notificationFeed, mutate: mutateNotifications, isLoading: loadingNotifications } = useSWR(
    'notifications:feed',
    () => fetchNotifications(),
    { revalidateOnFocus: false, dedupingInterval: 15_000 }
  );

  // --- Local State for Daily Focus & Notes ---
  const [focusList, setFocusList] = useState<FocusItem[]>([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [scratchpadText, setScratchpadText] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Hydration Safe LocalStorage Load ---
  useEffect(() => {
    setMounted(true);
    const storageKey = userId ? `planora:focus:${userId}` : 'planora:focus:default';
    const notesKey = userId ? `planora:notes:${userId}` : 'planora:notes:default';

    const savedList = localStorage.getItem(storageKey);
    const savedNotes = localStorage.getItem(notesKey);

    if (savedList) {
      try {
        setFocusList(JSON.parse(savedList));
      } catch (e) {
        console.error('Failed to parse focus list', e);
      }
    }
    if (savedNotes) {
      setScratchpadText(savedNotes);
    }
  }, [userId]);

  // --- Save Lists to LocalStorage ---
  const saveFocusList = (newList: FocusItem[]) => {
    setFocusList(newList);
    const storageKey = userId ? `planora:focus:${userId}` : 'planora:focus:default';
    localStorage.setItem(storageKey, JSON.stringify(newList));
    triggerSaveStatus();
  };

  const handleNotesChange = (text: string) => {
    setScratchpadText(text);
    const notesKey = userId ? `planora:notes:${userId}` : 'planora:notes:default';
    localStorage.setItem(notesKey, text);
    triggerSaveStatus();
  };

  const triggerSaveStatus = () => {
    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 1500);
    }, 600);
  };

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // --- Checklist Actions ---
  const addTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;
    const newItem: FocusItem = {
      id: Math.random().toString(36).substr(2, 9),
      text: newTodoText.trim(),
      completed: false,
    };
    saveFocusList([newItem, ...focusList]);
    setNewTodoText('');
  };

  const toggleTodo = (id: string) => {
    const updated = focusList.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    saveFocusList(updated);
  };

  const deleteTodo = (id: string) => {
    saveFocusList(focusList.filter((item) => item.id !== id));
  };

  // --- Calculate Progress metrics ---
  const totalTasks = assignedTasks?.length ?? 0;
  const completedTasks = assignedTasks?.filter((t) => t.status === 'DONE').length ?? 0;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // --- Notification Actions ---
  const handleNotificationClick = async (notif: Notification) => {
    try {
      if (!notif.read) {
        await markNotificationRead(notif.id);
        void mutateNotifications();
      }
      if (notif.link) {
        router.push(notif.link);
      }
    } catch (err) {
      console.error('Failed to handle notification click', err);
    }
  };

  if (!mounted) {
    return (
      <div className="flex flex-col gap-6 w-full animate-pulse">
        <div className="h-32 bg-cu-bg-secondary rounded-2xl" />
        <div className="h-64 bg-cu-bg-secondary rounded-2xl" />
        <div className="h-64 bg-cu-bg-secondary rounded-2xl" />
      </div>
    );
  }

  // Ring styling configurations
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* ─── Widget 1: Weekly Progress Tracker ─── */}
      <div className="relative glass-panel rounded-2xl p-5 border border-cu-border/50 bg-cu-bg/40 dark:bg-cu-bg-secondary/20 backdrop-blur-md shadow-cu-md hover:shadow-cu-lg transition-all duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-cu-primary/10 text-cu-primary rounded-lg">
              <Sparkles size={16} />
            </div>
            <h3 className="font-outfit text-[14px] font-bold text-cu-text-primary">Weekly Focus Velocity</h3>
          </div>
          <button 
            onClick={() => { void mutateTasks(); }}
            className="text-cu-text-muted hover:text-cu-primary transition-colors p-1"
            title="Refresh progress"
          >
            <RefreshCw size={12} className="hover:rotate-180 transition-transform duration-500" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          {/* SVG Progress Circle */}
          <div className="relative flex items-center justify-center shrink-0 w-20 h-20">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80" width="80" height="80">
              {/* Background Ring */}
              <circle
                cx="40"
                cy="40"
                r={radius}
                className="stroke-cu-bg-tertiary/60 dark:stroke-cu-bg-tertiary/20"
                strokeWidth="7"
                fill="transparent"
              />
              {/* Foreground Ring */}
              <motion.circle
                cx="40"
                cy="40"
                r={radius}
                className="stroke-cu-primary"
                strokeWidth="7"
                fill="transparent"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute font-outfit text-xs font-bold text-cu-primary">
              {progressPercentage}%
            </span>
          </div>

          <div className="flex flex-col min-w-0">
            <span className="font-outfit text-[15px] font-extrabold text-cu-text-primary leading-tight">
              Task Velocity
            </span>
            <span className="font-arimo text-xs text-cu-text-secondary mt-1">
              You have completed <strong className="text-cu-primary font-bold">{completedTasks}</strong> of <strong className="text-cu-text-primary font-bold">{totalTasks}</strong> total tasks assigned to you.
            </span>
          </div>
        </div>
      </div>

      {/* ─── Widget 2: Daily Focus Checklist & Notes ─── */}
      <div className="glass-panel rounded-2xl p-5 border border-cu-border/50 bg-cu-bg/40 dark:bg-cu-bg-secondary/20 backdrop-blur-md shadow-cu-md flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-cu-border/40 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-cu-primary/10 text-cu-primary rounded-lg">
              <ClipboardList size={16} />
            </div>
            <h3 className="font-outfit text-[14px] font-bold text-cu-text-primary">My Day's Focus</h3>
          </div>
          <span className="font-arimo text-[10px] font-semibold tracking-wider text-cu-text-muted uppercase min-w-[50px] text-right">
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'saved' && 'Saved'}
          </span>
        </div>

        {/* Checklist Section */}
        <form onSubmit={addTodo} className="flex gap-2">
          <input
            type="text"
            placeholder="Add focus item for today..."
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            className="flex-1 px-3 py-1.5 border border-cu-border rounded-lg bg-cu-bg/60 dark:bg-cu-bg-secondary/30 placeholder-cu-text-muted text-cu-text-primary focus:outline-none focus:ring-1 focus:ring-cu-primary/30 text-xs font-arimo"
          />
          <button
            type="submit"
            className="bg-cu-primary hover:bg-cu-primary-hover text-white px-3 py-1.5 rounded-lg text-xs font-bold font-outfit shadow-sm transition-all hover:-translate-y-0.5 active:scale-95 shrink-0"
          >
            Add
          </button>
        </form>

        <div className="max-h-[160px] overflow-y-auto custom-scrollbar flex flex-col gap-1.5 pr-0.5">
          <AnimatePresence initial={false}>
            {focusList.length === 0 ? (
              <p className="text-center py-4 font-arimo text-xs text-cu-text-muted italic">
                No items on your focus list today.
              </p>
            ) : (
              focusList.map((todo) => (
                <motion.div
                  key={todo.id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-cu-bg/40 dark:bg-cu-bg-secondary/10 hover:bg-cu-hover/50 border border-cu-border/30 transition-colors"
                >
                  <button
                    onClick={() => toggleTodo(todo.id)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        todo.completed
                          ? 'bg-cu-primary border-cu-primary text-white'
                          : 'border-cu-border hover:border-cu-primary/50'
                      }`}
                    >
                      {todo.completed && <Check size={10} strokeWidth={3} />}
                    </div>
                    <span
                      className={`font-arimo text-xs truncate transition-all ${
                        todo.completed
                          ? 'line-through text-cu-text-muted italic'
                          : 'text-cu-text-primary'
                      }`}
                    >
                      {todo.text}
                    </span>
                  </button>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="text-cu-text-muted hover:text-cu-danger transition-colors p-1"
                    title="Delete item"
                  >
                    <Trash2 size={12} />
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Scratchpad Section */}
        <div className="flex flex-col gap-2 pt-2 border-t border-cu-border/40">
          <div className="flex items-center gap-1.5 text-cu-text-secondary">
            <PenTool size={12} className="opacity-70" />
            <span className="font-outfit text-[11px] font-bold uppercase tracking-wider">Scratchpad</span>
          </div>
          <textarea
            placeholder="Type temporary notes or thoughts here (auto-saved)..."
            value={scratchpadText}
            onChange={(e) => handleNotesChange(e.target.value)}
            className="w-full h-24 p-2.5 text-xs font-arimo bg-cu-bg/60 dark:bg-cu-bg-secondary/30 border border-cu-border rounded-xl placeholder-cu-text-muted text-cu-text-primary focus:outline-none focus:ring-1 focus:ring-cu-primary/30 resize-none custom-scrollbar"
          />
        </div>
      </div>

      {/* ─── Widget 3: Recent Activity Timeline ─── */}
      <div className="glass-panel rounded-2xl p-5 border border-cu-border/50 bg-cu-bg/40 dark:bg-cu-bg-secondary/20 backdrop-blur-md shadow-cu-md flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-cu-border/40 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-cu-primary/10 text-cu-primary rounded-lg">
              <Calendar size={16} />
            </div>
            <h3 className="font-outfit text-[14px] font-bold text-cu-text-primary">Recent Activity</h3>
          </div>
          <button 
            onClick={() => { void mutateNotifications(); }}
            className="text-cu-text-muted hover:text-cu-primary transition-colors p-1"
            title="Refresh feed"
          >
            <RefreshCw size={12} className="hover:rotate-180 transition-transform duration-500" />
          </button>
        </div>

        <div className="flex flex-col gap-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-0.5 relative pt-1">
          {loadingNotifications && !notificationFeed ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <RefreshCw size={16} className="animate-spin text-cu-primary" />
              <span className="text-xs font-arimo text-cu-text-muted">Loading feed...</span>
            </div>
          ) : !notificationFeed?.notifications?.length ? (
            <p className="text-center py-6 font-arimo text-xs text-cu-text-muted italic">
              No recent activity.
            </p>
          ) : (
            <div className="flex flex-col gap-4 relative pl-3.5 border-l border-cu-border/60 dark:border-cu-border/30 ml-2">
              {notificationFeed.notifications.slice(0, 4).map((notif) => {
                const isUnread = !notif.read;
                return (
                  <div key={notif.id} className="relative group">
                    {/* Circle Indicator on timeline */}
                    <div
                      className={`absolute -left-[19.5px] top-1 w-2.5 h-2.5 rounded-full border-2 transition-all ${
                        isUnread
                          ? 'bg-cu-primary border-cu-bg scale-110 shadow-[0_0_8px_rgba(21,93,252,0.5)]'
                          : 'bg-cu-bg-tertiary border-cu-bg group-hover:bg-cu-primary/60'
                      }`}
                    />
                    <div className="flex flex-col min-w-0">
                      <button
                        onClick={() => handleNotificationClick(notif)}
                        className={`text-left font-arimo text-xs leading-relaxed transition-colors hover:text-cu-primary ${
                          isUnread ? 'font-bold text-cu-text-primary' : 'text-cu-text-secondary'
                        }`}
                      >
                        {notif.message}
                      </button>
                      <span className="font-arimo text-[10px] text-cu-text-muted mt-1">
                        {formatDateTime(notif.createdAt, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
