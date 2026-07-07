'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { PhoneInput } from 'react-international-phone';
import {
    Activity,
    BadgeCheck,
    Bell,
    BriefcaseBusiness,
    Building2,
    Camera,
    Clock3,
    IdCard,
    Mail,
    Menu,
    Phone,
    RefreshCw,
    Save,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
import { useProfile } from './hooks/useProfile';
import { useChangePassword } from './hooks/useChangePassword';
import ChangePasswordCard from './components/ChangePasswordCard';
import { BIO_MAX, disabledCls, formatRelativeTime, inputCls, labelCls, splitPhoneNumber } from './lib/profile-utils';

type SectionProps = {
    icon: ReactNode;
    title: string;
    description: string;
    children: ReactNode;
};

function ProfileSection({ icon, title, description, children }: SectionProps) {
    return (
        <section className="rounded-xl border border-cu-border bg-cu-bg shadow-cu-sm">
            <div className="flex items-start gap-3 border-b border-cu-border px-4 py-4 sm:px-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cu-primary/20 bg-cu-primary/10 text-cu-primary">
                    {icon}
                </div>
                <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold text-cu-text-primary">{title}</h2>
                    <p className="mt-0.5 text-xs text-cu-text-muted">{description}</p>
                </div>
            </div>
            <div className="space-y-4 px-4 py-4 sm:px-5">{children}</div>
        </section>
    );
}

function AccountFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center gap-3 rounded-lg border border-cu-border bg-cu-bg-secondary px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cu-bg text-cu-text-secondary shadow-cu-sm">
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase text-cu-text-muted">{label}</p>
                <p className="truncate text-sm font-medium text-cu-text-primary">{value}</p>
            </div>
        </div>
    );
}

export default function ProfilePage() {
    const [showNewPw, setShowNewPw] = useState(false);
    const [showConfirmPw, setShowConfirmPw] = useState(false);

    const {
        username, email,
        fullName, setFullName,
        firstName, setFirstName,
        lastName, setLastName,
        contactNumber, setContactNumber,
        countryCode, setCountryCode,
        jobTitle, setJobTitle,
        company, setCompany,
        position, setPosition,
        bio, setBio,
        resolvedProfilePicUrl, imageKey,
        lastActive,
        isLoading, isSavingName, isUploadingPhoto,
        hasUnsavedChanges, canSaveProfile,
        errorMessage, successMessage,
        reloadProfile,
        onSaveProfile, onUploadPhoto,
    } = useProfile();

    const changePassword = useChangePassword({ email });
    const displayName = fullName || username || 'User';
    const initials = (displayName || email || 'U').trim().charAt(0).toUpperCase();

    if (isLoading) {
        return (
            <div className="mobile-page-padding mx-auto w-full max-w-[1220px] px-4 py-5 sm:px-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-16 rounded-xl border border-cu-border bg-cu-bg" />
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                        <div className="h-[460px] rounded-xl border border-cu-border bg-cu-bg" />
                        <div className="space-y-4">
                            <div className="h-56 rounded-xl border border-cu-border bg-cu-bg" />
                            <div className="h-40 rounded-xl border border-cu-border bg-cu-bg" />
                            <div className="h-48 rounded-xl border border-cu-border bg-cu-bg" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mobile-page-padding mx-auto w-full max-w-[1220px] px-4 py-5 sm:px-6">
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-cu-border bg-cu-bg px-4 py-4 shadow-cu-sm sm:px-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('planora:sidebar:toggle'))}
                        className="shrink-0 rounded-lg p-2 text-cu-text-secondary transition-colors hover:bg-cu-hover md:hidden"
                        aria-label="Toggle Sidebar"
                    >
                        <Menu strokeWidth={2.5} size={21} />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-[24px] font-bold tracking-tight text-cu-text-primary sm:text-[28px]">Profile Settings</h1>
                        <p className="mt-0.5 text-sm text-cu-text-muted">Keep your identity, contact details, and account security current.</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href="/profile/notification-settings"
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-cu-border bg-cu-bg px-3 text-xs font-semibold text-cu-text-secondary transition-colors hover:border-cu-primary/30 hover:text-cu-primary"
                    >
                        <Bell size={14} className="text-cu-primary" />
                        Notifications
                    </Link>
                    <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-cu-success/30 bg-cu-success/10 px-3 text-xs font-semibold text-cu-success">
                        <BadgeCheck size={14} />
                        Verified
                    </span>
                    <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-cu-border bg-cu-bg-secondary px-3 text-xs font-semibold text-cu-text-secondary">
                        <Activity size={14} className="text-cu-success" />
                        Active
                    </span>
                </div>
            </div>

            {errorMessage && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cu-danger/30 bg-cu-danger/10 px-4 py-3 text-sm text-cu-danger shadow-cu-sm">
                    <span>{errorMessage}</span>
                    <button
                        type="button"
                        onClick={reloadProfile}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-cu-danger/20 bg-cu-bg px-3 text-xs font-semibold text-cu-danger transition-colors hover:bg-cu-danger/10"
                    >
                        <RefreshCw size={13} />
                        Retry
                    </button>
                </div>
            )}
            {successMessage && (
                <div className="mb-4 rounded-xl border border-cu-success/30 bg-cu-success/10 px-4 py-3 text-sm font-medium text-cu-success shadow-cu-sm">
                    {successMessage}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start">
                        <section className="rounded-xl border border-cu-border bg-cu-bg p-4 shadow-cu-sm sm:p-5">
                            <div className="flex flex-col items-center text-center">
                                <div className="relative">
                                    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-cu-border bg-cu-bg-tertiary shadow-cu-md ring-4 ring-cu-bg-secondary">
                                        {resolvedProfilePicUrl ? (
                                            <Image
                                                key={imageKey}
                                                src={resolvedProfilePicUrl}
                                                alt="Profile"
                                                width={112}
                                                height={112}
                                                className="h-full w-full object-cover"
                                                unoptimized
                                                priority
                                            />
                                        ) : (
                                            <span className="text-3xl font-bold text-cu-text-secondary">{initials}</span>
                                        )}
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border-4 border-cu-bg bg-cu-primary text-white shadow-cu-md">
                                        <Camera size={16} />
                                    </div>
                                </div>
                                <h2 className="mt-4 max-w-full truncate text-lg font-semibold text-cu-text-primary">{displayName}</h2>
                                <p className="max-w-full truncate text-sm text-cu-text-muted">{jobTitle || 'No job title set'}</p>
                                <p className="mt-1 max-w-full truncate text-xs text-cu-text-muted">{email}</p>
                                <label className={`mt-4 inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white shadow-cu-sm transition-colors ${
                                    isUploadingPhoto ? 'bg-cu-primary/60 cursor-not-allowed' : 'bg-cu-primary hover:bg-cu-primary-hover'
                                }`}>
                                    <Camera size={15} />
                                    {isUploadingPhoto ? 'Uploading photo...' : 'Change photo'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="user"
                                        className="hidden"
                                        onChange={onUploadPhoto}
                                        disabled={isUploadingPhoto}
                                    />
                                </label>
                                <p className="mt-2 text-xs text-cu-text-muted">JPG, PNG, GIF, or WebP up to 25 MB.</p>
                            </div>
                        </section>

                        <section className="space-y-3 rounded-xl border border-cu-border bg-cu-bg p-4 shadow-cu-sm sm:p-5">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-sm font-semibold text-cu-text-primary">Account Snapshot</h2>
                                <ShieldCheck size={16} className="text-cu-primary" />
                            </div>
                            <AccountFact icon={<IdCard size={15} />} label="Username" value={username || 'Not set'} />
                            <AccountFact icon={<Mail size={15} />} label="Email" value={email || 'Not set'} />
                            <AccountFact icon={<Clock3 size={15} />} label="Last active" value={formatRelativeTime(lastActive)} />
                        </section>
                    </aside>

                    <div className="min-w-0 space-y-4">
                        <form onSubmit={(e) => void onSaveProfile(e)} className="space-y-4">
                        <ProfileSection
                            icon={<UserRound size={17} />}
                            title="Personal"
                            description="How your name appears across projects, chat, and shared work."
                        >
                            <div>
                                <label className={labelCls}>Full name</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Your display name"
                                    className={inputCls}
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className={labelCls}>First name</label>
                                    <input
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="First name"
                                        className={inputCls}
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Last name</label>
                                    <input
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Last name"
                                        className={inputCls}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className={labelCls}>Username</label>
                                    <input type="text" value={username} disabled className={disabledCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Email</label>
                                    <input type="email" value={email} disabled className={disabledCls} />
                                </div>
                            </div>
                        </ProfileSection>

                        <ProfileSection
                            icon={<Phone size={17} />}
                            title="Contact"
                            description="Use a reachable number with the correct country selector."
                        >
                            <div>
                                <label className={labelCls}>Phone number</label>
                                <div className="profile-phone-input rounded-lg border border-cu-border bg-cu-bg shadow-cu-sm transition-colors focus-within:border-cu-primary focus-within:ring-2 focus-within:ring-cu-primary/20">
                                    <PhoneInput
                                        defaultCountry="us"
                                        value={`${countryCode}${contactNumber}`}
                                        onChange={(phone, meta) => {
                                            const dialCode = meta?.country?.dialCode ? `+${meta.country.dialCode}` : countryCode;
                                            const nextPhone = splitPhoneNumber(phone, dialCode);
                                            setCountryCode(nextPhone.countryCode);
                                            setContactNumber(nextPhone.contactNumber);
                                        }}
                                        inputStyle={{
                                            width: '100%',
                                            height: '2.75rem',
                                            border: 'none',
                                            borderRadius: '0 0.5rem 0.5rem 0',
                                            fontSize: '0.875rem',
                                            padding: '0 0.875rem',
                                            color: 'var(--cu-text-primary)',
                                            backgroundColor: 'transparent',
                                        }}
                                        countrySelectorStyleProps={{
                                            buttonStyle: {
                                                height: '2.75rem',
                                                border: 'none',
                                                borderRadius: '0.5rem 0 0 0.5rem',
                                                borderRight: '1px solid var(--cu-border)',
                                                padding: '0 0.75rem',
                                                backgroundColor: 'transparent',
                                            },
                                        }}
                                        style={{ width: '100%', display: 'flex' }}
                                    />
                                </div>
                                <p className="mt-1.5 text-xs text-cu-text-muted">Choose the country first so the dial code saves correctly.</p>
                            </div>
                        </ProfileSection>

                        <ProfileSection
                            icon={<BriefcaseBusiness size={17} />}
                            title="Work"
                            description="Give teammates enough context when they see you in tasks and reports."
                        >
                            <div>
                                <label className={labelCls}>Job title</label>
                                <input
                                    type="text"
                                    value={jobTitle}
                                    onChange={(e) => setJobTitle(e.target.value)}
                                    placeholder="e.g. Senior Engineer"
                                    className={inputCls}
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className={labelCls}>Company</label>
                                    <div className="relative">
                                        <Building2 size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cu-text-muted" />
                                        <input
                                            type="text"
                                            value={company}
                                            onChange={(e) => setCompany(e.target.value)}
                                            placeholder="Company name"
                                            className={`${inputCls} pl-9`}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Department / position</label>
                                    <input
                                        type="text"
                                        value={position}
                                        onChange={(e) => setPosition(e.target.value)}
                                        placeholder="e.g. Engineering"
                                        className={inputCls}
                                    />
                                </div>
                            </div>
                        </ProfileSection>

                        <ProfileSection
                            icon={<UserRound size={17} />}
                            title="Bio"
                            description="A short note for teammates who open your profile."
                        >
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
                                placeholder="Tell your team a little about yourself..."
                                rows={5}
                                className="w-full resize-none rounded-lg border border-cu-border bg-cu-bg px-3.5 py-2.5 text-sm text-cu-text-primary shadow-cu-sm transition-colors placeholder:text-cu-text-muted focus:border-cu-primary focus:outline-none focus:ring-2 focus:ring-cu-primary/20"
                            />
                            <div className="flex items-center justify-between gap-3 text-xs text-cu-text-muted">
                                <span>Keep it practical and team-facing.</span>
                                <span>{bio.length}/{BIO_MAX}</span>
                            </div>
                        </ProfileSection>

                        <div className="sticky bottom-3 z-20 rounded-xl border border-cu-border bg-cu-bg/95 px-4 py-3 shadow-cu-lg backdrop-blur sm:flex sm:items-center sm:justify-between">
                            <div className="mb-3 sm:mb-0">
                                <p className="text-sm font-semibold text-cu-text-primary">
                                    {hasUnsavedChanges ? 'Unsaved profile changes' : 'Profile is up to date'}
                                </p>
                                <p className="text-xs text-cu-text-muted">
                                    {hasUnsavedChanges ? 'Review your edits, then save them to your account.' : 'Make an edit to enable saving.'}
                                </p>
                            </div>
                            <button
                                type="submit"
                                disabled={!canSaveProfile}
                                className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-white shadow-cu-sm transition-colors sm:w-auto ${
                                    canSaveProfile ? 'bg-cu-primary hover:bg-cu-primary-hover' : 'cursor-not-allowed bg-cu-primary/50'
                                }`}
                            >
                                {isSavingName ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                                {isSavingName ? 'Saving...' : 'Save changes'}
                            </button>
                        </div>
                        </form>

                        <ChangePasswordCard
                            {...changePassword}
                            showNewPw={showNewPw}
                            setShowNewPw={setShowNewPw}
                            showConfirmPw={showConfirmPw}
                            setShowConfirmPw={setShowConfirmPw}
                        />
                    </div>
                </div>
            </div>
    );
}
