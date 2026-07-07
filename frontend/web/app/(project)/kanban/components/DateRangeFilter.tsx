'use client';

import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar, X } from 'lucide-react';
import { DateFilter } from '../types';

interface DateRangeFilterProps {
  onFilterChange: (filter: DateFilter) => void;
  initialFilter?: DateFilter;
}

export default function DateRangeFilter({
  onFilterChange,
  initialFilter,
}: DateRangeFilterProps) {
  const [startDate, setStartDate] = useState<Date | null>(
    initialFilter?.startDate || null
  );
  const [endDate, setEndDate] = useState<Date | null>(
    initialFilter?.endDate || null
  );
  const [isOpen, setIsOpen] = useState(false);

  const handleApply = () => {
    onFilterChange({ startDate, endDate });
    setIsOpen(false);
  };

  const handleReset = () => {
    setStartDate(null);
    setEndDate(null);
    onFilterChange({ startDate: null, endDate: null });
    setIsOpen(false);
  };

  const hasActiveFilter = startDate || endDate;

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors
          ${
            hasActiveFilter
              ? 'bg-cu-primary/10 border-cu-primary/30 text-cu-primary font-medium'
              : 'bg-cu-bg-secondary border-cu-border text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary'
          }
        `}
      >
        <Calendar size={18} />
        <span className="text-sm">
          {hasActiveFilter
            ? `${startDate?.toLocaleDateString() || ''} ${endDate ? `- ${endDate.toLocaleDateString()}` : ''}`
            : 'Filter by Date'}
        </span>
      </button>

      {/* Filter Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-cu-bg border border-cu-border rounded-xl shadow-cu-xl p-4 z-50 min-w-[min(24rem,calc(100vw-2rem))]">
          <div className="space-y-4">
            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-cu-text-primary mb-2">
                Start Date
              </label>
              <DatePicker
                selected={startDate}
                onChange={(date: Date | null) => setStartDate(date)}
                dateFormat="MMM d, yyyy"
                minDate={new Date(2020, 0, 1)}
                maxDate={endDate || new Date()}
                placeholderText="Select start date"
                wrapperClassName="w-full"
                className="w-full px-3 py-2 border border-cu-border bg-cu-bg-secondary text-cu-text-primary rounded-lg focus:outline-none focus:border-cu-primary focus:ring-2 focus:ring-cu-primary/30"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-cu-text-primary mb-2">
                End Date
              </label>
              <DatePicker
                selected={endDate}
                onChange={(date: Date | null) => setEndDate(date)}
                dateFormat="MMM d, yyyy"
                minDate={startDate || new Date(2020, 0, 1)}
                maxDate={new Date()}
                placeholderText="Select end date"
                wrapperClassName="w-full"
                className="w-full px-3 py-2 border border-cu-border bg-cu-bg-secondary text-cu-text-primary rounded-lg focus:outline-none focus:border-cu-primary focus:ring-2 focus:ring-cu-primary/30"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleApply}
                className="flex-1 px-4 py-2 bg-cu-primary text-white rounded-lg font-medium hover:bg-cu-primary-hover transition-colors"
              >
                Apply Filter
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2 border border-cu-border text-cu-text-secondary rounded-lg font-medium hover:bg-cu-hover transition-colors"
              >
                Reset
              </button>
            </div>

            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-2 right-2 p-1 text-cu-text-muted hover:text-cu-text-secondary"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Close overlay when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[var(--cu-z-overlay)]"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
