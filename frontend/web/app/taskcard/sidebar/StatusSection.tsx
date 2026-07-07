'use client';
import React, { useEffect, useState } from 'react';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useProjectStatuses } from '@/hooks/useProjectStatuses';

interface StatusSectionProps {
  projectId?: number;
  status: string;
  onUpdateStatus?: (status: string) => void;
}

const StatusSection: React.FC<StatusSectionProps> = ({ projectId, status, onUpdateStatus }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const { statuses } = useProjectStatuses(projectId);

  const currentStatus = statuses.find(s => s.status === status) || statuses[0] || { name: status, status, color: 'bg-gray-100 text-gray-700' };

  const handleSelect = (option: string) => {
    if (option === 'DONE' && status !== 'DONE') setShowDone(true);
    onUpdateStatus?.(option);
    setIsOpen(false);
  };

  const currentIndex = statuses.findIndex(s => s.status === status);
  const getIsBackward = (option: string) => {
    const targetIndex = statuses.findIndex(s => s.status === option);
    return targetIndex !== -1 && currentIndex !== -1 && targetIndex < currentIndex;
  };

  useEffect(() => {
    if (!isOpen) return;
    const close = () => setIsOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [isOpen]);

  return (
    <div>
      <label className="text-xs font-semibold text-cu-text-secondary uppercase mb-2 block tracking-wide">Status</label>
      <div className="relative">
        <button
          disabled={!onUpdateStatus}
          onClick={(e) => { e.stopPropagation(); setIsOpen((v) => !v); }}
          className={`w-full flex items-center justify-between px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-2 border rounded text-sm font-semibold transition-colors shadow-sm ${currentStatus.color} border-transparent hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-70`}
        >
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${currentStatus.color.split(' ')[0].replace('bg-', 'bg-').replace('-50', '-500').replace('-100', '-400')}`} />
            <span>{currentStatus.name}</span>
          </div>
          <ChevronDown size={16} className="opacity-60" />
        </button>
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-cu-bg border border-cu-border rounded-lg shadow-cu-lg z-[var(--cu-z-dropdown)] overflow-hidden">
            {statuses.map((option) => {
              const isCurrent = option.status === status;
              return (
                <button
                  key={option.status}
                  onClick={(e) => { e.stopPropagation(); handleSelect(option.status); }}
                  className={`w-full text-left px-3 py-2 min-h-[44px] sm:min-h-0 text-sm border-b border-cu-border last:border-b-0 flex items-center gap-2 transition-colors hover:opacity-80 font-medium ${option.color} ${isCurrent ? 'ring-2 ring-inset ring-cu-primary/20' : ''}`}
                  title={getIsBackward(option.status) ? 'This moves the task backward in the workflow.' : undefined}
                >
                  <span className={`w-2 h-2 rounded-full ${option.color.split(' ')[0].replace('bg-', 'bg-').replace('-50', '-500').replace('-100', '-400')}`} />
                  {option.name}
                  {getIsBackward(option.status) && (
                    <AlertTriangle size={12} className="ml-auto text-amber-500 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <AnimatePresence>
        {showDone && (
          <motion.div
            className="flex items-center justify-center mt-2"
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: [1.2, 1], opacity: [1, 0] }}
            transition={{ duration: 0.6 }}
            onAnimationComplete={() => setShowDone(false)}
          >
            <span className="text-2xl text-green-500">✓</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StatusSection;
