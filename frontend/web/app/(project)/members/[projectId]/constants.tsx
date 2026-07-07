import { Crown, Eye, ShieldCheck, User, Users, Activity, Clock3 } from 'lucide-react';

export const ICONS = {
  members: <Users className="h-5 w-5" aria-hidden="true" />,
  active: <Activity className="h-5 w-5" aria-hidden="true" />,
  admin: <ShieldCheck className="h-5 w-5" aria-hidden="true" />,
  pending: <Clock3 className="h-5 w-5" aria-hidden="true" />,
  owner: <Crown className="h-3.5 w-3.5" aria-hidden="true" />,
  adminRole: <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />,
  member: <User className="h-3.5 w-3.5" aria-hidden="true" />,
  viewer: <Eye className="h-3.5 w-3.5" aria-hidden="true" />,
};

export const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

export const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  ADMIN: 'bg-cu-primary/10 text-cu-primary',
  MEMBER: 'bg-sky-50 text-sky-700',
  VIEWER: 'bg-cu-bg-tertiary text-cu-text-secondary',
};

export const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-cu-success-light text-cu-success',
  Pending: 'bg-cu-warning-light text-cu-warning',
};

export const ROLE_OPTIONS = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
