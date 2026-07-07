import {
  buildVerifyEmailPath,
  isEmailVerificationRequired,
  rememberPendingVerificationEmail,
} from './email-verification';

describe('email verification error handling', () => {
  beforeEach(() => localStorage.clear());

  it.each(['EMAIL_NOT_VERIFIED', 'UNVERIFIED_EMAIL'])(
    'recognizes the %s error code',
    (errorCode) => {
      expect(isEmailVerificationRequired({ response: { data: { errorCode } } })).toBe(true);
    },
  );

  it('does not treat an ordinary forbidden response as a verification error', () => {
    expect(isEmailVerificationRequired({ response: { data: { errorCode: 'FORBIDDEN' } } })).toBe(false);
  });

  it('builds an actionable verification route and remembers the account email', () => {
    const email = 'Alice+Planora@Example.com';

    rememberPendingVerificationEmail(email);

    expect(buildVerifyEmailPath(email)).toBe('/verify-email?email=alice%2Bplanora%40example.com');
    expect(localStorage.getItem('pendingVerificationEmail')).toBe('alice+planora@example.com');
  });
});
