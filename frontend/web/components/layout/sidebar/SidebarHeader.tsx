'use client';

import React from 'react';
import { PlanoraIcon } from '@/components/brand/PlanoraLogo';

export function SidebarHeader({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      className="h-[60px] flex items-center flex-shrink-0 border-b border-cu-sidebar-border"
      style={{ 
        paddingLeft: collapsed ? '0' : '16px',
        justifyContent: collapsed ? 'center' : 'flex-start'
      }}
    >
      <button
        type="button"
        onClick={() => {
          if (collapsed && onToggle) onToggle();
        }}
        className={`flex items-center gap-3 min-w-0 ${collapsed ? 'cursor-pointer' : 'cursor-default'}`}
        aria-label={collapsed ? 'Expand sidebar' : 'Sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Planora'}
      >
        <PlanoraIcon size={32} />

        {/* Wordmark (Website Name) */}
        {!collapsed && (
          <span
            className="font-extrabold text-[17px] tracking-tight whitespace-nowrap"
            style={{
              background: 'linear-gradient(90deg, #155DFC 0%, #9810FA 55%, #F6339A 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            planora
          </span>
        )}
      </button>
    </div>
  );
}

export function CollapseButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="hidden md:flex absolute top-[18px] right-[-12px] z-[var(--cu-z-sidebar-panel)] w-[24px] h-[24px] items-center justify-center rounded-full bg-cu-bg border border-cu-sidebar-border shadow-md text-cu-sidebar-text hover:text-cu-primary hover:border-cu-primary/40 hover:shadow-lg hover:scale-110 transition-all duration-200 active:scale-95"
    >
      <svg 
        width="12" 
        height="12" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
