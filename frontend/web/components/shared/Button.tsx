'use client';
import React from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?:   Variant;
    size?:      Size;
    isLoading?: boolean;
    leftIcon?:  React.ReactNode;
    rightIcon?: React.ReactNode;
}

const BASE =
    'inline-flex items-center justify-center gap-2 rounded-cu-md font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cu-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-cu-bg disabled:pointer-events-none disabled:opacity-50 select-none whitespace-nowrap';

const VARIANT: Record<Variant, string> = {
    primary:
        'bg-cu-primary text-white shadow-cu-sm hover:bg-cu-primary-hover hover:shadow-cu-md active:translate-y-px active:bg-cu-primary-dark',
    secondary:
        'border border-cu-border bg-cu-bg text-cu-text-primary shadow-cu-sm hover:bg-cu-bg-secondary hover:border-cu-border-light',
    ghost:
        'text-cu-text-secondary hover:bg-cu-bg-secondary hover:text-cu-text-primary',
    danger:
        'bg-cu-danger text-white shadow-cu-sm hover:bg-[#E54545] hover:shadow-cu-md active:translate-y-px active:bg-[#CC3D3D]',
    outline:
        'border border-cu-primary/35 bg-cu-primary/5 text-cu-primary hover:bg-cu-primary/10 hover:border-cu-primary/50',
};

const SIZE: Record<Size, string> = {
    sm:  'text-xs px-3 py-1.5 min-h-[32px]',
    md:  'text-sm px-4 py-2 min-h-[38px]',
    lg:  'text-sm px-5 py-2.5 min-h-[44px]',
};

export default function Button({
    variant   = 'primary',
    size      = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    children,
    className = '',
    disabled,
    ...props
}: ButtonProps) {
    return (
        <button
            className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <Loader2 size={14} className="animate-spin shrink-0" />
            ) : leftIcon ? (
                <span className="shrink-0">{leftIcon}</span>
            ) : null}
            {children}
            {!isLoading && rightIcon && (
                <span className="shrink-0">{rightIcon}</span>
            )}
        </button>
    );
}
