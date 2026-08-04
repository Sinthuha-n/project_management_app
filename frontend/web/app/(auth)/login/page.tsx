'use client';

import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import BrandLogo from '../components/UI/BrandLogo';
import { useLoginForm } from './useLoginForm';

/*
 * The Login View Component.
 * Because we abstracted the logic into `useLoginForm`, 
 * this file is extremely clean. Its only job is to bind the state variables 
 * to the HTML inputs and render the UI.
 */
export default function LoginPage() {
    // Destructure the state and handlers from our custom business logic hook.
  const {
    email, setEmail,
    password, setPassword,
    remember, setRemember,
    showPassword, setShowPassword,
    isLoading,
    isCheckingSession,
    error,
    cooldown,
    handleLogin,
  } = useLoginForm();

  if (isCheckingSession) {
    return <div className="min-h-screen" aria-label="Checking session" />;
  }

    return (

        <div className='min-h-screen flex flex-col items-center justify-center p-4'>

            {/* ── 1. Navigation ── */}
            <div className="w-full max-w-[420px] mb-4">
                <Link href={"/"} className='inline-flex items-center text-sm text-cu-text-muted hover:text-cu-text-primary transition-colors'>
                    {/* Accessibility: aria-hidden="true" tells screen readers to ignore this decorative icon */}
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to home
                </Link>
            </div>

            {/* ── 2. Brand Header ── */}
            <BrandLogo title="Planora" subtitle="Project Management Platform" />

            {/* ── 3. Main Card Container ── */}
            <div className='w-full max-w-[420px] glass-panel rounded-[24px] shadow-xl p-4 sm:p-8'>

                {/* ── Tab Switcher ── */}
                {/* Accessibility: role="tablist" and "tab" help screen readers understand this UI paradigm */}
                <div className='flex bg-cu-bg-secondary p-1.5 rounded-xl mb-8' role="tablist">
                    <button
                        role="tab"
                        aria-selected="true"
                        className='flex-1 bg-cu-bg text-cu-text-primary shadow-sm rounded-lg py-2.5 text-sm font-semibold'
                    >
                        Sign In
                    </button>
                    <Link
                        href="/register"
                        role="tab"
                        aria-selected="false"
                        className="flex-1 flex items-center justify-center text-cu-text-muted hover:text-cu-text-primary py-2.5 text-sm font-medium transition-colors"
                    >
                        Register
                    </Link>
                </div>

                {/* ── Error Banner ── */}
                {/* Accessibility: aria-live="polite" ensures the error is read aloud exactly when it appears */}
                {error && (
                    <div
                        id="login-error"
                        role="alert"
                        aria-live="polite"
                        className="mb-4 p-3 bg-cu-danger/10 border border-cu-danger/30 rounded-lg"
                    >
                        <p className="text-sm text-cu-danger">{error}</p>
                    </div>
                )}

                {/* ── The Form ── */}
                {/* noValidate tells the browser to let React handle the validation logic and error messages */}
                <form className='space-y-5' onSubmit={handleLogin} noValidate>

                    {/* Email Input */}
                    <div>
                        {/* Accessibility: htmlFor matches the input ID, making the label clickable */}
                        <label htmlFor="login-email" className="block text-xs font-semibold text-cu-text-muted mb-1.5 ml-1">
                            Email Address
                        </label>
                        <input
                            id="login-email"
                            type="email"
                            // Mobile OS hints for better UX on phones
                            autoComplete="email"
                            autoCapitalize="off"
                            autoCorrect="off"
                            inputMode="email"
                            // The text-[16px] prevents iOS Safari from auto-zooming
                            className="w-full px-4 py-3 rounded-xl border border-cu-border bg-cu-bg text-cu-text-primary placeholder:text-cu-text-muted focus:border-[var(--cu-focus-border)] focus:ring-4 focus:ring-[var(--cu-focus-ring)] outline-none transition-all text-[16px] sm:text-sm"
                            placeholder="Enter your email"
                            value={email}
                            // Data Normalization: Force lowercase immediately to prevent case-sensitive login bugs later.
                            onChange={(e) => setEmail(e.target.value.toLowerCase())}
                            // Accessibility: Links this specific input to the error banner above
                            aria-describedby={error ? 'login-error' : undefined}
                            aria-invalid={!!error}
                        />
                    </div>

                    {/* Password Input */}
                    <div>
                        <label htmlFor="login-password" className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Password</label>
                        <div className="relative">
                            <input
                                id="login-password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                className="w-full px-4 py-3 pr-11 rounded-xl border border-cu-border bg-cu-bg text-cu-text-primary placeholder:text-cu-text-muted focus:border-[var(--cu-focus-border)] focus:ring-4 focus:ring-[var(--cu-focus-ring)] outline-none transition-all text-[16px] sm:text-sm"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                aria-describedby={error ? 'login-error' : undefined}
                                aria-invalid={!!error}
                            />

                            {/* Visibility Toggle */}
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-cu-text-muted hover:text-cu-text-primary"
                                tabIndex={-1}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* ── Utilities: Remember Me & Forgot Password ── */}
                    <div className="flex items-center justify-between mt-2">
                        <label htmlFor="login-remember" className="flex items-center gap-2 cursor-pointer">
                            <input
                                id="login-remember"
                                type="checkbox"
                                checked={remember}
                                onChange={(e) => setRemember(e.target.checked)}
                                className="w-4 h-4 rounded border-cu-border accent-cu-primary"
                            />
                            <span className="text-cu-text-muted text-xs">Remember me for 30 days</span>
                        </label>
                        <Link href="/forgot-password" className="text-cu-primary hover:opacity-80 font-semibold text-xs">
                            Forgot password?
                        </Link>
                    </div>

                    {/* ── Submit Button ── */}
                     {/* Accessibility: The button's disabled state is managed by the isLoading flag to prevent multiple submissions */}
                    <button
                        type="submit"
                            disabled={isLoading || cooldown > 0}
                        className="w-full rounded-lg bg-[#155DFC] py-2 min-h-[44px] font-bold text-white shadow-sm transition-colors hover:bg-[#0C4DDA] disabled:cursor-not-allowed disabled:bg-[#155DFC] disabled:text-white disabled:opacity-60"
                    >
                            {isLoading ? 'Signing in...' : cooldown > 0 ? `Try again in ${cooldown}s` : 'Sign In'}
                    </button>
                </form>

                {/* ── Footer ── */}
                <p className="mt-8 text-center text-xs text-cu-text-muted">
                    © 2026 Planora. All rights reserved.
                </p>
            </div>
        </div>
    );
}
