'use client';

import Link from 'next/link';
import BrandLogo from '../components/UI/BrandLogo';
import { useForgotPasswordForm } from './useForgotPasswordForm';

export default function ForgotPasswordPage() {
  // Destructure the state and handlers from our custom hook.
  const {
    email, setEmail,
    submittedEmail,
    isLoading,
    submitted, setSubmitted,
    error,
    success,
    cooldown,
    handleSubmit,
  } = useForgotPasswordForm();

  return (
    <div className='min-h-screen flex flex-col items-center justify-center p-4'>

      {/* ── Top Navigation ── */}
      <div className="w-full max-w-[420px] mb-4">
        <Link href="/login" className='inline-flex items-center text-sm text-cu-text-muted hover:text-cu-text-primary transition-colors'>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to login
        </Link>
      </div>


      {/* ── Brand Header ── */}
      <BrandLogo title="Reset Password" subtitle="Enter your email to receive a reset code" />

      {/* Main Card Container */}
      <div className='w-full max-w-[420px] glass-panel rounded-[24px] shadow-xl p-4 sm:p-8'>

        {/* CONDITIONAL RENDERING: If the API call succeeds, we swap out the form 
            for a success message rather than routing them to a whole new page. */}
        {submitted ? (

          /* ── SUCCESS STATE ── */
          <div className="text-center py-8">
            <div className="mx-auto w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-cu-text-primary mb-2">Check your email</h2>
            <p className="text-cu-text-muted text-sm mb-4">
              We&apos;ve sent a password reset code to <br />
              <span className="font-semibold text-cu-text-primary">{submittedEmail}</span>
            </p>
            <p className="text-xs text-cu-text-muted mb-6">
              Go to the reset password page and enter the 6-digit code you received. The code will expire in 10 minutes.
            </p>
            {cooldown > 0 ? (
              <p className="text-sm text-cu-text-muted mb-4">
                Check your inbox. You can request another reset in{' '}
                <span className="font-semibold text-cu-primary">{cooldown}s</span>.
              </p>
            ) : null}
            <button
              onClick={() => setSubmitted(false)}
              disabled={cooldown > 0}
              className={`w-full font-semibold py-2.5 rounded-xl transition-colors mb-2 text-white ${
                cooldown > 0 ? 'bg-cu-primary/40 cursor-not-allowed' : 'bg-cu-primary hover:opacity-90'
              }`}
            >
              Send code to another email
            </button>
            <Link href={`/reset-password?email=${encodeURIComponent(submittedEmail)}`} className='block text-cu-primary hover:opacity-80 font-semibold text-sm text-center'>
              I already have a code
            </Link>
          </div>
        ) : (

          /* ── INPUT STATE ── */
          <form className='space-y-5' onSubmit={handleSubmit}>

            {/* Accessibility: aria-live="polite" ensures screen readers announce errors immediately */}
            {error && (
              <div id="forgot-error" role="alert" aria-live="polite" className="bg-cu-danger/10 border border-cu-danger/30 text-cu-danger px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div role="status" aria-live="polite" className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 px-4 py-3 rounded-lg text-sm">
                {success}
              </div>
            )}

            {/* Email Input */}
            <div>
              <label htmlFor="forgot-email" className="block text-xs font-semibold text-cu-text-muted mb-1.5 ml-1">
                Email Address
              </label>
              <input
                id="forgot-email"
                type="email"

                // Mobile OS hints: Prevents annoying auto-capitalization of the first letter.
                autoComplete="email"
                autoCapitalize="off"
                autoCorrect="off"
                inputMode="email"

                // Note: The text-[16px] on mobile prevents iOS Safari from automatically 
                // zooming the viewport when the user taps the input.
                className="w-full px-4 py-3 rounded-xl border border-cu-border bg-cu-bg text-cu-text-primary placeholder:text-cu-text-muted focus:border-cu-primary focus:ring-4 focus:ring-cu-primary/10 outline-none transition-all text-[16px] sm:text-sm"
                placeholder="Enter your email"
                value={email}

                // Normalize data early: Always push lowercase strings to the hook state.
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                required
                aria-describedby={error ? 'forgot-error' : undefined}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || cooldown > 0}
              className={`w-full font-bold py-2.5 min-h-[44px] rounded-lg transition-colors text-white ${
                isLoading ? 'bg-cu-primary/60 cursor-not-allowed' : 'bg-cu-primary hover:opacity-90'
              }`}
            >
              {isLoading ? 'Sending...' : cooldown > 0 ? `Try again in ${cooldown}s` : 'Send Reset Link'}
            </button>
          </form>
        )}

        {/* ── Footer ── */}
        <p className="mt-8 text-center text-xs text-cu-text-muted">
          © 2026 Planora. All rights reserved.
        </p>
      </div>
    </div>
  );
}
