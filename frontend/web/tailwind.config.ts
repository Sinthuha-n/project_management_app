import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cu: {
          primary: 'var(--cu-primary)',
          'primary-hover': 'var(--cu-primary-hover)',
          'primary-dark': '#0042A3',
          'primary-light': 'var(--cu-primary-light)',
          'primary-muted': 'var(--cu-primary-muted)',
          purple: 'var(--cu-purple)',
          'purple-hover': 'var(--cu-purple-hover)',
          'purple-light': 'var(--cu-purple-light)',
          'purple-muted': 'var(--cu-purple-muted)',
          sidebar: 'var(--cu-sidebar)',
          'sidebar-hover': 'var(--cu-sidebar-hover)',
          'sidebar-active': 'var(--cu-sidebar-active)',
          'sidebar-border': 'var(--cu-sidebar-border)',
          'sidebar-text': 'var(--cu-sidebar-text)',
          'sidebar-text-bright': 'var(--cu-sidebar-text-bright)',
          success: '#6BC950',
          'success-light': 'var(--cu-success-light)',
          warning: '#FF9F43',
          'warning-light': 'var(--cu-warning-light)',
          danger: '#FF5C5C',
          'danger-light': 'var(--cu-danger-light)',
          info: '#4299E1',
          'info-light': 'var(--cu-info-light)',
          bg: 'var(--cu-bg)',
          'bg-secondary': 'var(--cu-bg-secondary)',
          'bg-tertiary': 'var(--cu-bg-tertiary)',
          hover: 'var(--cu-hover)',
          border: 'var(--cu-border)',
          'border-light': 'var(--cu-border-light)',
          'text-primary': 'var(--cu-text-primary)',
          'text-secondary': 'var(--cu-text-secondary)',
          'text-tertiary': 'var(--cu-text-tertiary)',
          'text-muted': 'var(--cu-text-muted)',
        },
        status: {
          todo: '#D3D3D3',
          'in-progress': 'var(--cu-primary)',
          'in-review': '#FF9F43',
          done: '#6BC950',
        },
        priority: {
          urgent: '#FF5C5C',
          high: '#FF9F43',
          normal: 'var(--cu-primary)',
          low: '#D3D3D3',
        },
      },
      fontFamily: {
        inter: [
          'var(--font-inter)',
          'Inter',
          'system-ui',
          'sans-serif',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Noto Color Emoji',
        ],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],       // 11px
        xs: ['0.75rem', { lineHeight: '1.125rem' }],         // 12px
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],        // 13px
        base: ['0.875rem', { lineHeight: '1.375rem' }],      // 14px
        md: ['1rem', { lineHeight: '1.5rem' }],              // 16px
        lg: ['1.125rem', { lineHeight: '1.625rem' }],        // 18px
        xl: ['1.25rem', { lineHeight: '1.75rem' }],          // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],           // 24px
      },
      spacing: {
        '4.5': '1.125rem',  // 18px
        '13': '3.25rem',    // 52px
        '15': '3.75rem',    // 60px
        '18': '4.5rem',     // 72px
        'sidebar': '240px',
        'sidebar-collapsed': '56px',
        'topbar': '48px',
        'detail-panel': '400px',
      },
      borderRadius: {
        'cu-sm': '4px',
        'cu-md': '6px',
        'cu-lg': '8px',
        'cu-xl': '12px',
        'cu-2xl': '16px',
      },
      boxShadow: {
        'cu-sm': '0 1px 2px rgba(0, 0, 0, 0.06)',
        'cu-md': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'cu-lg': '0 8px 24px rgba(0, 0, 0, 0.12)',
        'cu-xl': '0 16px 48px rgba(0, 0, 0, 0.16)',
      },
      width: {
        'sidebar': '240px',
        'sidebar-collapsed': '56px',
        'detail-panel': '400px',
      },
      minWidth: {
        'sidebar': '240px',
        'sidebar-collapsed': '56px',
      },
      maxWidth: {
        'sidebar': '240px',
      },
      transitionDuration: {
        'fast': '100ms',
        'normal': '200ms',
        'slow': '300ms',
      },
      animation: {
        'shimmer': 'shimmer 1.5s infinite linear',
        'slide-up': 'slideUp 200ms ease-out',
        'slide-in-right': 'slideInRight 200ms ease-out',
        'fade-in': 'fadeIn 150ms ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(100%)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [
    typography,
  ],
};

export default config;
