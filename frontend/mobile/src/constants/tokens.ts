/**
 * Design tokens — mirrors web tokens.css
 * Primary: #155DFC  |  bg: #F9FAFB  |  border: #E8E8ED
 */
export const T = {
  // Brand
  primary:        '#155DFC',
  primaryHover:   '#0C4DDA',
  primaryLight:   '#EBF2FF',
  primaryMuted:   '#88B2FF',

  // Surfaces
  bg:             '#FFFFFF',
  bgSecondary:    '#F7F8FA',
  bgTertiary:     '#F0F1F3',

  // Borders
  border:         '#E8E8ED',
  borderLight:    '#F0F0F5',
  focusBorder:    '#64748B',
  focusShadow:    'rgba(100, 116, 139, 0.22)',

  // Text
  textPrimary:    '#1A1A2E',
  textSecondary:  '#6B6F7B',
  textMuted:      '#9CA3AF',
  textInverse:    '#FFFFFF',

  // Semantic feedback
  danger:         '#DC2626',
  dangerBg:       '#FEF2F2',
  dangerBorder:   '#FECACA',
  success:        '#15803D',
  successBg:      '#F0FDF4',
  successBorder:  '#BBF7D0',
  warning:        '#92400E',
  warningBg:      '#FFFBEB',
  warningBorder:  '#FDE68A',

  // Status
  statusTodo:     { bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF', border: '#E5E7EB' },
  statusInProg:   { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6', border: '#BFDBFE' },
  statusInReview: { bg: '#F5F3FF', text: '#6D28D9', dot: '#8B5CF6', border: '#DDD6FE' },
  statusDone:     { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E', border: '#BBF7D0' },

  // Shadows
  shadowSm:  '0 1px 3px rgba(0,0,0,0.06)',
  shadowMd:  '0 4px 12px rgba(0,0,0,0.08)',
  shadowLg:  '0 8px 24px rgba(0,0,0,0.12)',

  // Radius
  radiusSm:  4,
  radiusMd:  6,
  radiusLg:  8,
  radiusXl:  12,
  radius2xl: 16,

  // Spacing and touch geometry
  space1: 4,
  space2: 8,
  space3: 12,
  space4: 16,
  space5: 20,
  space6: 24,
  space8: 32,
  touchMin: 44,
  touchComfortable: 48,

  // Typography scale (captions remain at least 12sp)
  fontCaption: 12,
  fontBody: 14,
  fontBodyLarge: 16,
  fontTitle: 20,
  fontDisplay: 28,

  // Stripe colors (for project cards)
  stripes: ['#06B6D4', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'],
} as const;

export const NativeShadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  floating: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

export type StatusKey = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type StatusMeta = {
  bg: string;
  text: string;
  dot: string;
  border: string;
};

export const STATUS_MAP: Record<StatusKey, StatusMeta> = {
  TODO:        T.statusTodo,
  IN_PROGRESS: T.statusInProg,
  IN_REVIEW:   T.statusInReview,
  DONE:        T.statusDone,
};

export const STATUS_LABELS: Record<StatusKey, string> = {
  TODO:        'TODO',
  IN_PROGRESS: 'IN PROGRESS',
  IN_REVIEW:   'IN REVIEW',
  DONE:        'DONE',
};

/** Deterministic stripe color from project name (same algorithm as web) */
export function getStripeColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return T.stripes[Math.abs(hash) % T.stripes.length];
}
