const EMAIL_VERIFICATION_ERROR_CODES = new Set([
  'EMAIL_NOT_VERIFIED',
  // Current login endpoint code; retained for compatibility while protected
  // endpoints use EMAIL_NOT_VERIFIED.
  'UNVERIFIED_EMAIL',
]);

interface ApiErrorLike {
  response?: {
    data?: {
      errorCode?: unknown;
    };
  };
}

export function isEmailVerificationRequired(
  error: unknown,
  acceptedCodes: readonly string[] = [...EMAIL_VERIFICATION_ERROR_CODES],
): boolean {
  const errorCode = (error as ApiErrorLike)?.response?.data?.errorCode;
  return typeof errorCode === 'string' && acceptedCodes.includes(errorCode);
}

export function buildVerifyEmailPath(email?: string | null): string {
  return email
    ? `/verify-email?email=${encodeURIComponent(email.toLowerCase())}`
    : '/verify-email';
}

export function rememberPendingVerificationEmail(email?: string | null): void {
  if (email && typeof window !== 'undefined') {
    localStorage.setItem('pendingVerificationEmail', email.toLowerCase());
  }
}
