export const BIO_MAX = 300;

export type EditableProfileFields = {
    fullName: string;
    firstName: string;
    lastName: string;
    contactNumber: string;
    countryCode: string;
    jobTitle: string;
    company: string;
    position: string;
    bio: string;
};

export function formatRelativeTime(iso: string | null): string {
    if (!iso) return 'Never';
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

export function normalizeEditableProfile(fields: EditableProfileFields): EditableProfileFields {
    return {
        fullName: fields.fullName.trim(),
        firstName: fields.firstName.trim(),
        lastName: fields.lastName.trim(),
        contactNumber: fields.contactNumber.trim(),
        countryCode: fields.countryCode.trim(),
        jobTitle: fields.jobTitle.trim(),
        company: fields.company.trim(),
        position: fields.position.trim(),
        bio: fields.bio.trim(),
    };
}

export function hasProfileChanges(current: EditableProfileFields, loaded: EditableProfileFields | null): boolean {
    if (!loaded) return false;
    const normalizedCurrent = normalizeEditableProfile(current);
    const normalizedLoaded = normalizeEditableProfile(loaded);
    return Object.keys(normalizedCurrent).some((key) => {
        const field = key as keyof EditableProfileFields;
        return normalizedCurrent[field] !== normalizedLoaded[field];
    });
}

export function splitPhoneNumber(phone: string, dialCode: string): { countryCode: string; contactNumber: string } {
    const trimmedDialCode = dialCode.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedDialCode) return { countryCode: '', contactNumber: trimmedPhone };
    return {
        countryCode: trimmedDialCode,
        contactNumber: trimmedPhone.startsWith(trimmedDialCode)
            ? trimmedPhone.slice(trimmedDialCode.length).trim()
            : trimmedPhone,
    };
}

export const inputCls = 'h-10 w-full rounded-lg border border-cu-border bg-cu-bg text-cu-text-primary px-3.5 text-sm shadow-cu-sm transition-colors focus:outline-none focus:ring-2 focus:ring-cu-primary/20 focus:border-cu-primary placeholder:text-cu-text-muted';
export const disabledCls = 'h-10 w-full rounded-lg border border-cu-border bg-cu-bg-secondary text-cu-text-muted px-3.5 text-sm';
export const labelCls = 'mb-1.5 block text-[12px] font-semibold text-cu-text-secondary';
