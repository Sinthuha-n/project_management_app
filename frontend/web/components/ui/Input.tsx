'use client';

import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  label?: React.ReactNode;
  helpText?: React.ReactNode;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', icon, trailingIcon, label, helpText, error, id: providedId, ...props }, ref) => {
    const generatedId = React.useId();
    const id = providedId ?? `input-${generatedId}`;
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
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3 text-cu-text-tertiary pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            {...props}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={error ? true : props['aria-invalid']}
            className={[
              'w-full h-9 rounded-cu-md border bg-cu-bg text-cu-text-primary text-base',
              'placeholder:text-cu-text-tertiary',
              'focus:outline-none focus:ring-2 focus:ring-[var(--cu-focus-ring)] focus:border-[var(--cu-focus-border)]',
              'disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-cu-bg-secondary',
              'transition-colors duration-fast',
              error ? 'border-cu-danger' : 'border-cu-border',
              icon ? 'pl-9' : 'pl-3',
              trailingIcon ? 'pr-9' : 'pr-3',
              className,
            ].join(' ')}
          />
          {trailingIcon && (
            <div className="pointer-events-none absolute right-3 text-cu-text-tertiary">
              {trailingIcon}
            </div>
          )}
        </div>
        {helpText && (
          <p id={helpId} className="mt-1 text-xs text-cu-text-secondary">{helpText}</p>
        )}
        {error && (
          <p id={errorId} className="mt-1 text-xs text-cu-danger" role="alert">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
