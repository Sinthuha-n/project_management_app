'use client';

import React from 'react';

type DescribedControlProps = {
  id?: string;
  required?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
};

export interface FormFieldProps {
  id?: string;
  label: React.ReactNode;
  helpText?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactElement<DescribedControlProps>;
}

export function FormField({
  id: providedId,
  label,
  helpText,
  error,
  required,
  className = '',
  children,
}: FormFieldProps) {
  const generatedId = React.useId();
  const id = providedId ?? `field-${generatedId}`;
  const helpId = helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [
    children.props['aria-describedby'],
    helpId,
    errorId,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-cu-text-primary">
        {label}
        {required && <span className="ml-1 text-cu-danger" aria-hidden="true">*</span>}
      </label>
      {React.cloneElement(children, {
        id,
        required: required ?? children.props.required,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : children.props['aria-invalid'],
      })}
      {helpText && <p id={helpId} className="mt-1 text-xs text-cu-text-secondary">{helpText}</p>}
      {error && <p id={errorId} className="mt-1 text-xs text-cu-danger" role="alert">{error}</p>}
    </div>
  );
}
