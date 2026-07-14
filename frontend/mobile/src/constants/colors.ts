import { T } from './tokens';

/**
 * Backward-compatible semantic palette. New UI should consume `T` directly;
 * this bridge keeps existing feature screens on the same source of truth.
 */
export const Colors = {
  primary: T.primary,
  primaryPressed: T.primaryHover,
  gradientStart: T.primary,
  gradientMid: '#7C3AED',
  gradientEnd: '#DB2777',
  white: T.textInverse,
  errorRed: T.danger,
  errorRedBg: T.dangerBg,
  errorRedBorder: T.dangerBorder,
  successGreen: T.success,
  successGreenBg: T.successBg,
  textPrimary: T.textPrimary,
  textSecondary: T.textSecondary,
  textMuted: T.textMuted,
  borderDefault: T.border,
  cardBg: T.bg,
  pageBg: T.bgSecondary,
  chatBubbleMe: T.primary,
  chatBubbleMeText: T.textInverse,
  chatBubbleOther: T.bgTertiary,
  chatBubbleOtherText: T.textPrimary,
  chatSidebarBg: T.bg,
  chatHeaderBg: T.bg,
  chatInputBg: T.bgSecondary,
  chatDivider: T.borderLight,
  onlineGreen: '#059669',
  unreadBlue: T.primary,
  mentionAmber: '#D97706',
  bannerAmberBg: T.warningBg,
  bannerAmberBorder: T.warningBorder,
  bannerAmberText: T.warning,
  bannerRedBg: T.dangerBg,
  bannerRedBorder: T.dangerBorder,
  bannerRedText: '#991B1B',
} as const;
