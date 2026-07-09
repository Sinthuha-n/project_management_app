'use client';
import React from 'react';

interface TaskActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}

const TaskActionButton: React.FC<TaskActionButtonProps> = ({ icon, label, onClick, disabled = false, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] min-w-[44px] bg-cu-bg border border-cu-border hover:bg-cu-primary/5 hover:border-cu-primary/40 rounded-xl text-[12px] font-semibold text-cu-text-primary hover:text-cu-primary transition-all shadow-cu-sm disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-cu-bg disabled:hover:border-cu-border disabled:hover:text-cu-text-primary"
  >
    {icon} {label}
  </button>
);

export default TaskActionButton;
