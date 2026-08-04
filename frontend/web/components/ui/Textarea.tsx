'use client';

import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  helpText?: React.ReactNode;
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', label, helpText, error, id: providedId, ...props }, ref) => {
    const generatedId = React.useId();
    const id = providedId ?? `textarea-${generatedId}`;
    const helpId = helpText ? `${id}-help` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [props['aria-describedby'], helpId, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-cu-text-primary">
            {label}
            {props.required && <span className="ml-1 text-cu-danger" aria-hidden="true">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          {...props}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : props['aria-invalid']}
          className={[
            'w-full rounded-cu-md border bg-cu-bg px-3 py-2 text-base text-cu-text-primary',
            'placeholder:text-cu-text-tertiary',
            'focus:border-[var(--cu-focus-border)] focus:outline-none focus:ring-2 focus:ring-[var(--cu-focus-ring)]',
            'disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-cu-bg-secondary',
            'transition-colors duration-fast',
            error ? 'border-cu-danger' : 'border-cu-border',
            className,
          ].join(' ')}
        />
        {helpText && <p id={helpId} className="mt-1 text-xs text-cu-text-secondary">{helpText}</p>}
        {error && <p id={errorId} className="mt-1 text-xs text-cu-danger" role="alert">{error}</p>}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
