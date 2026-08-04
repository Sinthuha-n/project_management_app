import React, { useState, useMemo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import 'react-day-picker/dist/style.css';
import { formatDateTime } from '@/lib/date-time';
import { useTimeZone } from '@/components/providers/TimeZoneProvider';

interface DateSectionProps {
  dates: {
    created: string;
    updated: string;
    dueDate: string | null;
    startDate?: string | null;
  };
  onUpdateDueDate?: (dueDate: string | null) => void;
  onUpdateStartDate?: (startDate: string | null) => void;
}

const DateSection: React.FC<DateSectionProps> = ({ dates, onUpdateDueDate, onUpdateStartDate }) => {
  const { timeZone } = useTimeZone();
  const [open, setOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);

  // parseISO is used instead of new Date() to avoid timezone offset issues with bare YYYY-MM-DD strings
  const parsedDueDate = dates.dueDate ? parseISO(dates.dueDate) : undefined;
  const parsedStartDate = dates.startDate ? parseISO(dates.startDate) : undefined;
  const dueDateIsPast = useMemo(() => {
    if (!parsedDueDate) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return parsedDueDate < today;
  }, [parsedDueDate]);

  const handleSelect = (date: Date | undefined) => {
    if (onUpdateDueDate) {
      if (date) {
        onUpdateDueDate(format(date, 'yyyy-MM-dd'));
      } else {
        onUpdateDueDate(null);
      }
    }
    setOpen(false);
  };

  const handleStartSelect = (date: Date | undefined) => {
    if (onUpdateStartDate) {
      if (date) {
        onUpdateStartDate(format(date, 'yyyy-MM-dd'));
      } else {
        onUpdateStartDate(null);
      }
    }
    setStartOpen(false);
  };

  return (
    <div className="p-4 space-y-4">
        {dates.dueDate !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-cu-text-secondary font-medium">Due date</span>
            {onUpdateDueDate ? (
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2">
                  <Popover.Root open={open} onOpenChange={setOpen}>
                    <Popover.Trigger asChild>
                      <button className="flex items-center gap-2 text-sm text-cu-text-primary bg-cu-bg-secondary hover:bg-cu-hover px-3 py-1.5 min-h-[44px] sm:min-h-0 rounded border border-cu-border focus:outline-none focus:ring-2 focus:ring-cu-primary transition-colors">
                        <CalendarIcon size={14} className="text-cu-text-muted" />
                        {parsedDueDate ? format(parsedDueDate, 'MMM d, yyyy') : 'No date'}
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      {/* Popover.Portal renders outside the sidebar so overflow:hidden on the modal panel can't clip the calendar */}
                      <Popover.Content className="z-[var(--cu-z-modal-popover)] p-3 bg-cu-bg rounded-xl shadow-cu-xl border border-cu-border" sideOffset={5} align="end">
                        <DayPicker
                          mode="single"
                          selected={parsedDueDate}
                          onSelect={handleSelect}
                          showOutsideDays
                        />
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                  {parsedDueDate && (
                    <button
                      onClick={() => handleSelect(undefined)}
                      className="p-1 rounded-full hover:bg-cu-hover text-cu-text-muted hover:text-cu-text-primary transition-colors"
                      title="Clear date"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {dueDateIsPast && (
                  <p className="text-xs text-orange-500 mt-1 max-w-[200px] text-right leading-tight">
                    This date is in the past — task will be immediately overdue.
                  </p>
                )}
              </div>
            ) : (
              <span className="text-sm text-cu-text-primary bg-cu-bg-secondary px-2 py-1 rounded border border-cu-border">
                {parsedDueDate ? format(parsedDueDate, 'MMM d, yyyy') : 'No date'}
              </span>
            )}
          </div>
        )}
        {dates.startDate !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-cu-text-secondary font-medium">Start date</span>
            {onUpdateStartDate ? (
              <div className="flex items-center gap-2">
                <Popover.Root open={startOpen} onOpenChange={setStartOpen}>
                  <Popover.Trigger asChild>
                    <button className="flex items-center gap-2 text-sm text-cu-text-primary bg-cu-bg-secondary hover:bg-cu-hover px-3 py-1.5 min-h-[44px] sm:min-h-0 rounded border border-cu-border focus:outline-none focus:ring-2 focus:ring-cu-primary transition-colors">
                      <CalendarIcon size={14} className="text-cu-text-muted" />
                      {parsedStartDate ? format(parsedStartDate, 'MMM d, yyyy') : 'No date'}
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content className="z-[var(--cu-z-modal-popover)] p-3 bg-cu-bg rounded-xl shadow-cu-xl border border-cu-border" sideOffset={5} align="end">
                      <DayPicker mode="single" selected={parsedStartDate} onSelect={handleStartSelect} showOutsideDays />
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
                {parsedStartDate && (
                  <button onClick={() => handleStartSelect(undefined)} className="p-1 rounded-full hover:bg-cu-hover text-cu-text-muted hover:text-cu-text-primary transition-colors" title="Clear date">
                    <X size={14} />
                  </button>
                )}
              </div>
            ) : (
              <span className="text-sm text-cu-text-primary bg-cu-bg-secondary px-2 py-1 rounded border border-cu-border">
                {parsedStartDate ? format(parsedStartDate, 'MMM d, yyyy') : 'No date'}
              </span>
            )}
          </div>
        )}
        {dates.created && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-cu-text-secondary font-medium">Created</span>
            <span className="text-xs text-cu-text-primary">{formatDateTime(dates.created, {}, timeZone)}</span>
          </div>
        )}
        {dates.updated && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-cu-text-secondary font-medium">Updated</span>
            <span className="text-xs text-cu-text-primary">{formatDateTime(dates.updated, {}, timeZone)}</span>
          </div>
        )}
    </div>
  );
};

export default DateSection;
