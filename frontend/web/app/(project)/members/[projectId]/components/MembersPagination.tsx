'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { getPageNumbers } from '../utils';
import { MEMBERS_PAGE_SIZE_OPTIONS } from '../types';

export interface MembersPaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  pageSizeOptions?: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  disabled?: boolean;
}

export function MembersPagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  startIndex,
  endIndex,
  pageSizeOptions = MEMBERS_PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
  disabled = false,
}: MembersPaginationProps) {
  if (totalItems === 0) return null;

  const pageNumbers = getPageNumbers(currentPage, totalPages);
  const fromItem = totalItems === 0 ? 0 : startIndex + 1;
  const toItem = Math.min(endIndex, totalItems);

  const buttonBaseClass =
    'inline-flex h-8.5 min-w-8.5 items-center justify-center rounded-cu-md border text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none';

  return (
    <nav
      aria-label="Members pagination"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-cu-border bg-cu-bg-secondary/40 px-4 py-3 sm:px-6"
    >
      {/* Left side: Page size selector and items count */}
      <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-cu-text-secondary">
        <div className="flex items-center gap-2">
          <label
            htmlFor="members-page-size-select"
            className="text-xs font-medium text-cu-text-secondary whitespace-nowrap"
          >
            Rows per page:
          </label>
          <select
            id="members-page-size-select"
            value={pageSize}
            disabled={disabled}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-cu-md border border-cu-border bg-cu-bg px-2.5 text-xs font-semibold text-cu-text-primary shadow-cu-sm outline-none transition-colors focus:border-cu-primary/40 focus:ring-2 focus:ring-cu-primary/15 disabled:opacity-50"
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <span className="text-cu-border-dark select-none hidden sm:inline" aria-hidden="true">
          |
        </span>

        <div className="text-xs font-medium">
          Showing <span className="font-bold text-cu-text-primary">{fromItem}</span>
          {fromItem !== toItem && (
            <>
              –<span className="font-bold text-cu-text-primary">{toItem}</span>
            </>
          )}{' '}
          of <span className="font-bold text-cu-text-primary">{totalItems}</span> members
        </div>
      </div>

      {/* Right side: Page navigation controls */}
      <div className="flex items-center justify-center sm:justify-end gap-1 overflow-x-auto py-0.5">
        {/* First Page */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={disabled || currentPage <= 1}
          className={`${buttonBaseClass} px-2 border-cu-border bg-cu-bg text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary`}
          title="First page"
          aria-label="First page"
        >
          <ChevronsLeft size={15} />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={disabled || currentPage <= 1}
          className={`${buttonBaseClass} px-2 border-cu-border bg-cu-bg text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary`}
          title="Previous page"
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>

        {/* Numeric Page Buttons & Ellipsis */}
        {pageNumbers.map((pg, index) => {
          if (pg === '...') {
            return (
              <span
                key={`ellipsis-${index}`}
                className="inline-flex h-8.5 min-w-7 items-center justify-center text-xs text-cu-text-muted select-none px-1"
                aria-hidden="true"
              >
                &hellip;
              </span>
            );
          }

          const pageNum = Number(pg);
          const isActive = pageNum === currentPage;

          return (
            <button
              key={`page-${pageNum}`}
              type="button"
              onClick={() => onPageChange(pageNum)}
              disabled={disabled}
              className={`${buttonBaseClass} px-2.5 min-w-[32px] ${
                isActive
                  ? 'border-cu-primary bg-cu-primary text-white shadow-cu-sm'
                  : 'border-cu-border bg-cu-bg text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary'
              }`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`Page ${pageNum}`}
            >
              {pageNum}
            </button>
          );
        })}

        {/* Next Page */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={disabled || currentPage >= totalPages}
          className={`${buttonBaseClass} px-2 border-cu-border bg-cu-bg text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary`}
          title="Next page"
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={disabled || currentPage >= totalPages}
          className={`${buttonBaseClass} px-2 border-cu-border bg-cu-bg text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary`}
          title="Last page"
          aria-label="Last page"
        >
          <ChevronsRight size={15} />
        </button>
      </div>
    </nav>
  );
}

export default MembersPagination;
