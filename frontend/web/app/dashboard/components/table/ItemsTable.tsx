'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { DashboardItem } from './types';
import { EmptyState, ItemIcon, StatusBadge } from './SharedComponents';

interface ItemsTableProps {
  activeTab: string;
  searchQuery: string;
  visibleData: DashboardItem[];
  filteredItems: DashboardItem[];
  visibleCount: number;
  hoveredSlice: string | null;
  onRowClick: (item: DashboardItem) => void;
  onShowMore: () => void;
  onShowLess: () => void;
}

// ─── Table Header ─────────────────────────────────────────────────────────────

function TableHeader({ activeTab }: { activeTab: string }) {
  const thBase = 'py-3 px-4 text-left font-outfit text-[11px] font-bold text-cu-text-muted uppercase tracking-widest border-b border-cu-border/40';

  const nameLabel = activeTab === 'boards' ? 'Board Name' : activeTab === 'favorites' ? 'Project Name' : activeTab === 'assigned-to-me' ? 'Task Name' : 'Name';
  const rightLabel = activeTab === 'assigned-to-me' ? 'Status' : activeTab === 'boards' ? 'Project' : activeTab === 'favorites' ? 'Project Key' : 'Location';

  return (
    <tr className="bg-cu-bg-secondary/40 dark:bg-cu-bg-secondary/20">
      <th className="py-3 px-4 w-[64px] border-b border-cu-border/40" />
      <th className={`${thBase} w-[300px] lg:w-[400px]`}>{nameLabel}</th>
      <th className={thBase}>{rightLabel}</th>
    </tr>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function TableRow({
  item,
  index,
  activeTab,
  hoveredSlice,
  onRowClick,
}: {
  item: DashboardItem;
  index: number;
  activeTab: string;
  hoveredSlice: string | null;
  onRowClick: (item: DashboardItem) => void;
}) {
  const isDimmed =
    activeTab === 'assigned-to-me' && hoveredSlice !== null && item.status !== hoveredSlice;

  return (
    <motion.tr
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: activeTab === 'assigned-to-me' ? Math.min(index * 0.05, 0.4) : 0,
      }}
      key={item.id}
      className={`group border-b border-cu-border/40 hover:bg-cu-primary/[0.03] dark:hover:bg-cu-primary/[0.05] cursor-pointer transition-all duration-300 last:border-b-0 ${
        isDimmed ? 'opacity-20 scale-[0.99] grayscale' : 'opacity-100'
      }`}
      onClick={() => onRowClick(item)}
    >
      <td className="py-3 px-4 w-[64px] whitespace-nowrap">
        <ItemIcon item={item} />
      </td>
      <td className="py-3 px-4 w-[300px] lg:w-[400px] text-cu-text-primary font-outfit text-[14px] font-bold">
        <div className="flex flex-col">
          <span className="group-hover:text-cu-primary transition-colors truncate max-w-[280px] sm:max-w-[360px] lg:max-w-[380px]" title={item.name}>
            {item.name}
          </span>
          {activeTab === 'assigned-to-me' && (
            <span className="text-[11px] font-medium text-cu-text-muted mt-0.5 group-hover:text-cu-text-secondary transition-colors">
              {item.location}
            </span>
          )}
        </div>
      </td>
      <td className="py-3 px-4 whitespace-nowrap">
        {activeTab === 'assigned-to-me' ? (
          item.type === 'TASK' && <StatusBadge status={item.status ?? 'TODO'} />
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-cu-bg-tertiary/60 dark:bg-cu-bg-tertiary/20 border border-cu-border/40 text-cu-text-secondary group-hover:bg-cu-primary/10 group-hover:text-cu-primary group-hover:border-cu-primary/20 transition-all duration-300">
            <svg className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" />
            </svg>
            <span className="truncate max-w-[120px]">{item.location}</span>
          </span>
        )}
      </td>
    </motion.tr>
  );
}

// ─── Pagination Controls ──────────────────────────────────────────────────────

function PaginationControls({
  visibleCount,
  totalCount,
  onShowMore,
  onShowLess,
}: {
  visibleCount: number;
  totalCount: number;
  onShowMore: () => void;
  onShowLess: () => void;
}) {
  if (totalCount <= 5) return null;

  return (
    <div className="w-full flex items-center justify-center gap-3 mt-4 mb-2 pt-4 border-t border-cu-border">
      {visibleCount < totalCount && (
        <button
          onClick={onShowMore}
          className="group flex items-center gap-1.5 px-4 py-1.5 font-arimo text-[13px] font-semibold text-cu-text-primary bg-cu-bg border border-cu-border rounded-full shadow-sm hover:text-cu-primary hover:border-cu-primary/30 hover:bg-cu-primary/5 transition-all active:scale-95"
        >
          <span>Show More</span>
          <svg className="w-3.5 h-3.5 text-cu-text-muted group-hover:text-cu-primary transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}
      {visibleCount > 5 && (
        <button
          onClick={onShowLess}
          className="group flex items-center gap-1.5 px-4 py-1.5 font-arimo text-[13px] font-semibold text-cu-text-primary bg-cu-bg border border-cu-border rounded-full shadow-sm hover:text-cu-text-primary hover:border-cu-border hover:bg-cu-hover transition-all active:scale-95"
        >
          <span>Show Less</span>
          <svg className="w-3.5 h-3.5 text-cu-text-muted group-hover:text-cu-text-secondary transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Main Items Table ─────────────────────────────────────────────────────────

export function ItemsTable({
  activeTab,
  searchQuery,
  visibleData,
  filteredItems,
  visibleCount,
  hoveredSlice,
  onRowClick,
  onShowMore,
  onShowLess,
}: ItemsTableProps) {
  const colSpan = 3;

  return (
    <div className="w-full flex flex-col">
      <div className="w-full glass-panel rounded-2xl overflow-hidden shadow-cu-md border border-cu-border/50 bg-cu-bg/40 dark:bg-cu-bg-secondary/20 backdrop-blur-md">
        <div className="w-full overflow-x-auto custom-scrollbar">
          <table className="min-w-full border-collapse">
            <thead>
              <TableHeader activeTab={activeTab} />
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="py-8 text-center">
                    <EmptyState activeTab={activeTab} searchQuery={searchQuery} />
                  </td>
                </tr>
              ) : (
                visibleData.map((item, index) => (
                  <TableRow
                    key={item.id}
                    item={item}
                    index={index}
                    activeTab={activeTab}
                    hoveredSlice={hoveredSlice}
                    onRowClick={onRowClick}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationControls
        visibleCount={visibleCount}
        totalCount={filteredItems.length}
        onShowMore={onShowMore}
        onShowLess={onShowLess}
      />
    </div>
  );
}
