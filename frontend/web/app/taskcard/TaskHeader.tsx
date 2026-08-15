"use client";
import React, { useRef, useState } from 'react';
import { Layout, Link2, MoreHorizontal, X, Check, FileText, Calendar, Flag } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from '@/components/ui';
import { getDueDateMeta, getPriorityStyle, getStatusTone } from './components/taskUi';

interface TaskHeaderProps {
  project: string;
  taskId: string;
  numericTaskId?: number;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  onClose?: (wasModified: boolean) => void;
}

const TaskHeader: React.FC<TaskHeaderProps> = ({
  project,
  taskId,
  numericTaskId,
  status,
  priority,
  dueDate,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateInput, setShowTemplateInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const openTemplateInput = () => {
    setShowTemplateInput(true);
    setDropdownOpen(false);
    // setTimeout defers focus until after the input has been rendered into the DOM
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSaveTemplate = async () => {
    if (!numericTaskId || !templateName.trim()) return;
    setSavingTemplate(true);
    try {
      await api.post(`/api/tasks/${numericTaskId}/save-as-template`, { templateName: templateName.trim() });
      toast('Template saved successfully', 'success');
      setShowTemplateInput(false);
      setTemplateName('');
    } catch {
      toast('Failed to save template', 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const statusTone = getStatusTone(status);
  const priorityStyle = getPriorityStyle(priority);
  const dueMeta = getDueDateMeta(dueDate, status);

  return (
    <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 border-b border-cu-border bg-cu-bg/95 backdrop-blur sticky top-0 z-10 flex-shrink-0">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <Layout size={15} className="text-cu-primary flex-shrink-0" />
          <span className="font-medium text-cu-text-secondary truncate">{project}</span>
          <span className="flex-shrink-0 text-cu-text-muted">/</span>
          <span className="text-cu-text-primary font-semibold flex-shrink-0">{taskId}</span>
        </div>
        <div className="hidden min-w-0 items-center gap-1.5 sm:flex">
          {statusTone && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone.bg} ${statusTone.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusTone.dot}`} />
              {statusTone.label}
            </span>
          )}
          {priorityStyle && priority && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${priorityStyle.bg} ${priorityStyle.text}`}>
              <Flag size={10} />
              {priorityStyle.label}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${dueMeta.className}`}>
            <Calendar size={10} />
            {dueMeta.label}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {showTemplateInput && (
          <div className="flex items-center gap-1 mr-1">
            <input
              ref={inputRef}
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTemplate();
                if (e.key === 'Escape') { setShowTemplateInput(false); setTemplateName(''); }
              }}
              placeholder="Template name…"
              className="h-8 border border-cu-border bg-cu-bg text-cu-text-primary rounded-lg px-2 text-xs w-40 focus:outline-none focus:ring-2 focus:ring-cu-primary/20 focus:border-cu-primary"
            />
            <button
              onClick={handleSaveTemplate}
              disabled={savingTemplate || !templateName.trim()}
              className="h-8 px-2 bg-cu-primary text-white rounded-lg text-xs hover:bg-cu-primary-hover disabled:opacity-50 transition-colors"
            >
              {savingTemplate ? '…' : 'Save'}
            </button>
            <button
              onClick={() => { setShowTemplateInput(false); setTemplateName(''); }}
              className="p-1.5 hover:bg-cu-hover rounded-lg text-cu-text-muted"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <button
          onClick={handleCopyLink}
          title="Copy link"
          className="p-2 hover:bg-cu-hover rounded-lg flex items-center gap-1.5 text-cu-text-secondary hover:text-cu-primary text-xs transition-colors"
        >
          {copied ? <Check size={15} className="text-green-500" /> : <Link2 size={15} />}
          <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy link'}</span>
        </button>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="p-2 hover:bg-cu-hover rounded-lg text-cu-text-secondary hover:text-cu-primary transition-colors"
            title="More options"
          >
            <MoreHorizontal size={18} />
          </button>
          {dropdownOpen && (
            <>
              {/* Full-screen invisible overlay closes the dropdown when the user clicks outside it */}
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-44 bg-cu-bg border border-cu-border rounded-xl shadow-cu-lg z-20 py-1">
                <button
                  onClick={openTemplateInput}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-cu-text-primary hover:bg-cu-hover transition-colors"
                >
                  <FileText size={15} className="text-cu-text-muted" />
                  Save as Template
                </button>
              </div>
            </>
          )}
        </div>
        <button
          onClick={() => onClose?.(false)}
          className="p-2 hover:bg-cu-danger/10 rounded-lg text-cu-text-secondary hover:text-cu-danger transition-colors"
          title="Close"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default TaskHeader;
