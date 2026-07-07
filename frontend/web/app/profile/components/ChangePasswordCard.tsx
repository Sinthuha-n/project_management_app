'use client';

import { Dispatch, FormEvent, SetStateAction } from 'react';
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import PasswordChecklist from '@/app/(auth)/components/UI/PasswordChecklist';
import { inputCls, labelCls } from '../lib/profile-utils';

type PwStep = 'idle' | 'sent' | 'done';

type ChangePasswordCardProps = {
    pwStep: PwStep;
    setPwStep: Dispatch<SetStateAction<PwStep>>;
    isSendingOtp: boolean;
    isResettingPw: boolean;
    otp: string;
    setOtp: Dispatch<SetStateAction<string>>;
    newPassword: string;
    setNewPassword: Dispatch<SetStateAction<string>>;
    confirmPassword: string;
    setConfirmPassword: Dispatch<SetStateAction<string>>;
    error: string;
    success: string;
    handleSendOtp: () => Promise<void>;
    handleResetPassword: () => Promise<void>;
    showNewPw: boolean;
    setShowNewPw: Dispatch<SetStateAction<boolean>>;
    showConfirmPw: boolean;
    setShowConfirmPw: Dispatch<SetStateAction<boolean>>;
};

function handleReset(
    setPwStep: Dispatch<SetStateAction<PwStep>>,
    setOtp: Dispatch<SetStateAction<string>>,
    setNewPassword: Dispatch<SetStateAction<string>>,
    setConfirmPassword: Dispatch<SetStateAction<string>>,
) {
    setPwStep('idle');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
}

export default function ChangePasswordCard({
    pwStep, setPwStep,
    isSendingOtp, isResettingPw,
    otp, setOtp,
    newPassword, setNewPassword,
    confirmPassword, setConfirmPassword,
    error, success,
    handleSendOtp, handleResetPassword,
    showNewPw, setShowNewPw,
    showConfirmPw, setShowConfirmPw,
}: ChangePasswordCardProps) {
    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        void handleResetPassword();
    };

    return (
        <section className="rounded-xl border border-cu-border bg-cu-bg shadow-cu-sm">
            <div className="flex items-start gap-3 border-b border-cu-border px-4 py-4 sm:px-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cu-primary/20 bg-cu-primary/10 text-cu-primary">
                    <LockKeyhole size={16} />
                </div>
                <div>
                    <h2 className="text-[15px] font-semibold text-cu-text-primary">Security</h2>
                    <p className="mt-0.5 text-xs text-cu-text-muted">A reset code will be sent to your email address.</p>
                </div>
            </div>

            <div className="space-y-4 px-4 py-4 sm:px-5">
                {error && (
                    <div className="rounded-lg border border-cu-danger/30 bg-cu-danger/10 px-4 py-3 text-sm text-cu-danger shadow-cu-sm">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="rounded-lg border border-cu-success/30 bg-cu-success/10 px-4 py-3 text-sm text-cu-success shadow-cu-sm">
                        {success}
                    </div>
                )}

                {pwStep === 'idle' && (
                    <button
                        type="button"
                        onClick={() => void handleSendOtp()}
                        disabled={isSendingOtp}
                        className={`min-h-10 rounded-lg px-5 text-sm font-semibold text-white shadow-cu-sm transition-colors ${
                            isSendingOtp ? 'cursor-not-allowed bg-cu-primary/60' : 'bg-cu-primary hover:bg-cu-primary-hover'
                        }`}
                    >
                        {isSendingOtp ? 'Sending...' : 'Send reset code'}
                    </button>
                )}

                {pwStep === 'sent' && (
                    <form className="space-y-4" onSubmit={onSubmit}>
                        <div>
                            <label className={labelCls}>Reset code</label>
                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="Enter the code from your email"
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className={labelCls}>New password</label>
                            <div className="relative">
                                <input
                                    type={showNewPw ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Min 8 chars, upper, lower, digit, symbol"
                                    className={inputCls + ' pr-11'}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPw((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-cu-text-muted transition-colors hover:text-cu-text-primary"
                                    tabIndex={-1}
                                    aria-label={showNewPw ? 'Hide password' : 'Show password'}
                                >
                                    {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {newPassword.length > 0 && (
                                <div className="mt-1.5">
                                    <PasswordChecklist password={newPassword} unmetClassName="text-cu-text-muted" />
                                </div>
                            )}
                        </div>
                        <div>
                            <label className={labelCls}>Confirm password</label>
                            <div className="relative">
                                <input
                                    type={showConfirmPw ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Repeat new password"
                                    className={inputCls + ' pr-11'}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPw((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-cu-text-muted transition-colors hover:text-cu-text-primary"
                                    tabIndex={-1}
                                    aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                                >
                                    {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <button
                                type="submit"
                                disabled={isResettingPw}
                                className={`min-h-10 rounded-lg px-5 text-sm font-semibold text-white shadow-cu-sm transition-colors sm:w-auto ${
                                    isResettingPw ? 'cursor-not-allowed bg-cu-primary/60' : 'bg-cu-primary hover:bg-cu-primary-hover'
                                }`}
                            >
                                {isResettingPw ? 'Resetting...' : 'Reset password'}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleReset(setPwStep, setOtp, setNewPassword, setConfirmPassword)}
                                className="min-h-10 rounded-lg border border-cu-border bg-cu-bg px-5 text-sm font-semibold text-cu-text-secondary transition-colors hover:bg-cu-hover sm:w-auto"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}

                {pwStep === 'done' && (
                    <div className="flex items-center gap-3 rounded-lg border border-cu-success/30 bg-cu-success/10 p-4 text-sm text-cu-success shadow-cu-sm">
                        <ShieldCheck size={16} className="shrink-0" />
                        Password changed successfully.
                        <button
                            type="button"
                            onClick={() => setPwStep('idle')}
                            className="ml-auto text-xs font-semibold text-cu-success hover:underline"
                        >
                            Reset again
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
