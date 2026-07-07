import { LIST_GRID_CLASS } from '../lib/list-config';

interface TaskTableHeaderProps {
  allVisibleSelected?: boolean;
  toggleSelectAllVisible?: () => void;
}

export default function TaskTableHeader({
  allVisibleSelected = false,
  toggleSelectAllVisible,
}: TaskTableHeaderProps) {
  return (
    <div className={`sticky top-0 z-10 hidden border-b border-cu-border bg-cu-bg-secondary/95 text-[10px] font-bold uppercase tracking-wider text-cu-text-tertiary md:${LIST_GRID_CLASS}`}>
      <span className="flex items-center justify-center">
        {toggleSelectAllVisible && (
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAllVisible}
            className="h-4 w-4 rounded border-cu-border accent-cu-primary cursor-pointer transition-all"
            aria-label="Select all visible tasks"
          />
        )}
      </span>
      <span>Priority</span>
      <span>Title</span>
      <span>Labels</span>
      <span className="hidden xl:block">Milestone</span>
      <span>Assignee</span>
      <span>Status</span>
      <span>Due</span>
      <span></span> {/* Actions space */}
    </div>
  );
}

