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
    <div className={`hidden md:grid bg-cu-bg-secondary/50 backdrop-blur-sm border-b border-cu-border text-[10px] font-bold text-cu-text-tertiary uppercase tracking-wider sticky top-0 z-10 ${LIST_GRID_CLASS}`}>
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
      <span></span> {/* Priority bar space */}
      <span className="hidden lg:block">Priority</span>
      <span>Title</span>
      <span className="hidden lg:block">Labels</span>
      <span className="hidden xl:block">Milestone</span>
      <span className="hidden md:block">Assignee</span>
      <span>Status</span>
      <span className="hidden sm:block">Due</span>
      <span></span> {/* Actions space */}
    </div>
  );
}


