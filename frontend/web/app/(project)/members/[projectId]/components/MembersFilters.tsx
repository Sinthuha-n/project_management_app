import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import Button from '@/components/shared/Button';

interface MembersFiltersProps {
  search: string;
  roleFilter: string | null;
  statusFilter: string | null;
  showFilters: boolean;
  onSearchChange: (value: string) => void;
  onToggleFilters: () => void;
  onRoleFilterChange: (value: string | null) => void;
  onStatusFilterChange: (value: string | null) => void;
}

export function MembersFilters({
  search,
  roleFilter,
  statusFilter,
  showFilters,
  onSearchChange,
  onToggleFilters,
  onRoleFilterChange,
  onStatusFilterChange,
}: MembersFiltersProps) {
  const activeFilters = Number(Boolean(roleFilter)) + Number(Boolean(statusFilter));

  return (
    <div className="rounded-cu-lg border border-cu-border bg-cu-bg p-3 shadow-cu-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cu-text-muted" aria-hidden="true" />
          <input
            type="text"
            className="h-11 w-full rounded-cu-md border border-cu-border bg-cu-bg-secondary pl-10 pr-10 text-sm text-cu-text-primary transition-colors placeholder:text-cu-text-muted focus:border-cu-primary/40 focus:bg-cu-bg focus:outline-none focus:ring-2 focus:ring-cu-primary/15"
            placeholder="Search members by name or email..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-cu-md text-cu-text-muted transition-colors hover:bg-cu-hover hover:text-cu-text-primary"
              onClick={() => onSearchChange('')}
              aria-label="Clear member search"
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>
        <Button
          variant="secondary"
          size="lg"
          leftIcon={<SlidersHorizontal size={16} />}
          onClick={onToggleFilters}
          aria-expanded={showFilters}
          className="relative w-full rounded-cu-md lg:w-auto"
        >
          Filters
          {activeFilters > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cu-primary px-1.5 text-xs font-bold text-white">
              {activeFilters}
            </span>
          )}
        </Button>
      </div>

      {showFilters && (
        <div className="mt-3 grid gap-3 border-t border-cu-border pt-3 sm:grid-cols-2 lg:flex lg:items-center">
          <label className="min-w-0">
            <span className="mb-1.5 block text-xs font-semibold uppercase text-cu-text-muted">Role</span>
            <span className="relative block">
              <select
                className="h-11 w-full appearance-none rounded-cu-md border border-cu-border bg-cu-bg px-3 pr-9 text-sm font-medium text-cu-text-primary shadow-cu-sm transition-colors focus:border-cu-primary/40 focus:outline-none focus:ring-2 focus:ring-cu-primary/15"
                value={roleFilter || ''}
                onChange={(e) => onRoleFilterChange(e.target.value || null)}
              >
                <option value="">All Roles</option>
                <option value="OWNER">Owner</option>
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-cu-text-muted" aria-hidden="true" />
            </span>
          </label>

          <label className="min-w-0">
            <span className="mb-1.5 block text-xs font-semibold uppercase text-cu-text-muted">Status</span>
            <span className="relative block">
              <select
                className="h-11 w-full appearance-none rounded-cu-md border border-cu-border bg-cu-bg px-3 pr-9 text-sm font-medium text-cu-text-primary shadow-cu-sm transition-colors focus:border-cu-primary/40 focus:outline-none focus:ring-2 focus:ring-cu-primary/15"
                value={statusFilter || ''}
                onChange={(e) => onStatusFilterChange(e.target.value || null)}
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-cu-text-muted" aria-hidden="true" />
            </span>
          </label>

          {activeFilters > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="md"
              className="self-end justify-center text-cu-text-secondary sm:col-span-2 lg:self-end"
              onClick={() => {
                onRoleFilterChange(null);
                onStatusFilterChange(null);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
