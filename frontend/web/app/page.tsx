'use client';

import Link from 'next/link';
import { ReactNode, useEffect, useState, useSyncExternalStore, useMemo } from 'react';
import { PlanoraIcon, PlanoraLogo } from '@/components/brand/PlanoraLogo';
import { AUTH_TOKEN_CHANGED_EVENT, ensureValidToken, getUserFromToken, getValidToken, logout, User } from '@/lib/auth';
import { LogoutConfirmModal } from '@/components/auth/LogoutConfirmModal';
import { toast } from '@/components/ui/Toast';
import styles from './page.module.css';

// --- ICONS ---

function IconSmart() {
  return (
    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function IconTimeline() {
  return (
    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconTeam() {
  return (
    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function IconStart() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function IconDashboard() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

// --- REUSABLE COMPONENTS ---

type ButtonVariant = 'primary' | 'ghost' | 'outlined';
type ArrowType = 'arrow-right' | 'arrow-down';

interface ArrowIconProps {
  type: ArrowType;
  variant: ButtonVariant;
}

function ArrowIcon({ type, variant }: ArrowIconProps) {
  const color = variant === 'primary' ? 'text-[#1d56d5]' : 'text-white';
  const hoverTransform = type === 'arrow-right' ? 'group-hover:translate-x-1' : '';

  const paths = {
    'arrow-right': <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" />,
    'arrow-down': <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />,
  };

  return (
    <svg className={`w-3.5 h-3.5 ${color} ${hoverTransform} transition-transform`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {paths[type]}
    </svg>
  );
}

interface ButtonProps {
  variant?: ButtonVariant;
  href?: string;
  onClick?: () => void;
  icon?: ArrowType;
  mobileIcon?: ReactNode;
  children: ReactNode;
  fullWidth?: boolean;
}

function Button({ variant = 'primary', href, onClick, icon, mobileIcon, children, fullWidth = false }: ButtonProps) {
  const baseClasses = 'h-11 sm:h-10 rounded-lg px-4 sm:px-6 cursor-pointer transition-all flex items-center justify-center gap-2';

  const variantClasses = {
    primary: 'bg-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 group',
    ghost: 'hover:bg-white/10 transition-colors',
    outlined: 'bg-white/10 border border-white/30 hover:bg-white/20 backdrop-blur-sm',
  };

  const textClasses = {
    primary: 'font-semibold text-[#1d56d5] text-sm',
    ghost: 'font-medium text-sm text-white whitespace-nowrap',
    outlined: 'font-medium text-white text-sm',
  };

  const widthClass = fullWidth ? 'w-full sm:w-auto' : '';
  const heightClass = variant === 'ghost' ? 'h-9' : 'h-11 sm:h-10';

  const content = (
    <div className={`${baseClasses} ${heightClass} ${variantClasses[variant]} ${widthClass} ${textClasses[variant]}`}>
      {mobileIcon && <div className="sm:hidden flex items-center justify-center">{mobileIcon}</div>}
      <p className={`${mobileIcon ? 'hidden sm:block' : ''}`}>{children}</p>
      {icon && <div className={mobileIcon ? 'hidden sm:block' : ''}><ArrowIcon type={icon} variant={variant} /></div>}
    </div>
  );

  if (href) {
    return <Link href={href} className={widthClass}>{content}</Link>;
  }

  return (
    <button type="button" onClick={onClick} className={`${widthClass} bg-transparent border-0 p-0 text-left cursor-pointer`}>
      {content}
    </button>
  );
}

interface IconContainerProps {
  children: ReactNode;
  variant?: 'solid' | 'glass';
}

function IconContainer({ children, variant = 'glass' }: IconContainerProps) {
  const classes = variant === 'solid'
    ? 'bg-white relative rounded-lg shrink-0 w-9 h-9 flex items-center justify-center p-2 text-blue-600'
    : 'bg-white/20 rounded-xl w-11 h-11 flex items-center justify-center mb-3';

  return <div className={classes}>{children}</div>;
}

// --- STORAGE LISTENER ---

const subscribeToBrowserStorage = (onChange: () => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', onChange);
  window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, onChange);
  };
};

// --- COMPONENTS ---

function LogoContainer() {
  return (
    <div className="flex items-center">
      <div className="hidden sm:block">
        <PlanoraLogo width={140} style={{ filter: 'drop-shadow(0 2px 8px rgba(21,93,252,0.15))' }} />
      </div>
      <div className="block sm:hidden">
        <PlanoraIcon size={28} />
      </div>
    </div>
  );
}

interface NavButtonsProps {
  user: User | null;
  onLogoutClick: () => void;
}

function NavButtons({ user, onLogoutClick }: NavButtonsProps) {
  if (user) {
    const displayName = user.username || user.fullName || 'Account';
    const initial = displayName.charAt(0).toUpperCase();

    return (
      <div className="flex gap-2 sm:gap-3 items-center">
        {/* User profile pill */}
        <Link
          href="/profile"
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-medium backdrop-blur-sm transition-all"
        >
          <div className="w-6 h-6 rounded-full bg-white/25 flex items-center justify-center font-bold text-white text-[11px] ring-1 ring-white/30">
            {initial}
          </div>
          <span className="max-w-[120px] truncate">{displayName}</span>
        </Link>

        {/* Dashboard link */}
        <Button variant="primary" href="/dashboard" icon="arrow-right" mobileIcon={<IconDashboard />}>
          Dashboard
        </Button>

        {/* Log Out button */}
        <Button variant="ghost" onClick={onLogoutClick} mobileIcon={<IconLogout />}>
          Log Out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2 sm:gap-3 items-center">
      <Button variant="ghost" href="/login" mobileIcon={<IconUser />}>Sign In</Button>
      <Button variant="primary" href="/register" mobileIcon={<IconStart />}>Get Started</Button>
    </div>
  );
}

function Navigation({ user, onLogoutClick }: NavButtonsProps) {
  return (
    <div className="bg-white/10 w-full border-b border-white/20">
      <div className="h-16 sm:h-[72px] w-full flex items-center justify-between px-4 sm:px-6 md:px-8">
        <LogoContainer />
        <NavButtons user={user} onLogoutClick={onLogoutClick} />
      </div>
    </div>
  );
}

function HeroSection({ user }: { user: User | null }) {
  return (
    <div className="relative w-full flex flex-col items-center pt-10 sm:pt-16 md:pt-20 px-4">
      {/* Badge */}
      <div className={styles.heroBadge}>
        <p className="font-semibold text-[10px] sm:text-xs text-white uppercase tracking-wider">✨ The Future of Project Management</p>
      </div>

      <h1 className="font-bold text-[32px] sm:text-4xl md:text-5xl lg:text-[64px] leading-[1.1] text-center text-white mb-6 max-w-4xl">
        Manage Projects <br className="hidden sm:block" /> <span className="sm:hidden text-white/90">Smartly</span> with Planora
      </h1>

      <p className="text-[14px] sm:text-base md:text-lg leading-relaxed text-white/80 text-center max-w-xl mb-10 px-4">
        The all-in-one platform for high-performance teams. Plan, track, and deliver extraordinary work without the complexity.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-16 sm:mb-20 w-full sm:w-auto max-w-[280px] sm:max-w-none">
        {user ? (
          <>
            <Button variant="primary" href="/dashboard" icon="arrow-right" fullWidth>
              Go to Dashboard
            </Button>
            <Button variant="outlined" href="#features" icon="arrow-down" fullWidth>
              Learn More
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" href="/register" icon="arrow-right" fullWidth>
              Get Started
            </Button>
            <Button variant="outlined" href="#features" icon="arrow-down" fullWidth>
              Learn More
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className={styles.glassCard}>
      <IconContainer variant="glass">
        {icon}
      </IconContainer>
      <h3 className="font-semibold text-base sm:text-[17px] text-white mb-2">{title}</h3>
      <p className="text-xs sm:text-[13px] leading-relaxed text-white/80">{desc}</p>
    </div>
  );
}

function FeaturesGrid() {
  return (
    <div id="features" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-6 md:gap-8 max-w-6xl mx-auto px-6 sm:px-8 pb-16 sm:pb-24 scroll-mt-20">
      <FeatureCard
        icon={<IconSmart />}
        title="Smart Backlogs"
        desc="Organize your work with intelligent backlogs, sprints, and automated task management."
      />
      <FeatureCard
        icon={<IconTimeline />}
        title="Timeline & Calendar"
        desc="Visualize your project lifecycle. Track deadlines, milestones, and team velocity at a glance."
      />
      <FeatureCard
        icon={<IconTeam />}
        title="Unified Collaboration"
        desc="Built-in communication tools ensure your team stays synchronized, wherever they are."
      />
    </div>
  );
}

export default function Page() {
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [asyncUser, setAsyncUser] = useState<User | null>(null);

  const token = useSyncExternalStore<string | null>(
    subscribeToBrowserStorage,
    () => getValidToken(),
    () => null,
  );

  const immediateUser = useMemo<User | null>(() => {
    if (!token) return null;
    return getUserFromToken();
  }, [token]);

  // Check auth and silently refresh from cookie if token was in cookie
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      const valid = await ensureValidToken();
      if (isMounted) {
        if (valid) {
          setAsyncUser(getUserFromToken());
        } else {
          setAsyncUser(null);
        }
      }
    };

    void checkAuth();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const currentUser = immediateUser || asyncUser;

  const handleOpenLogout = () => {
    setLogoutModalOpen(true);
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      setAsyncUser(null);
      setLogoutModalOpen(false);
      toast.success('You have been logged out successfully.');
    } catch (error) {
      console.error('Logout error:', error);
      setAsyncUser(null);
      setLogoutModalOpen(false);
      toast.success('You have been logged out.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className={styles.mainContainer}>
      <Navigation user={currentUser} onLogoutClick={handleOpenLogout} />
      <HeroSection user={currentUser} />
      <FeaturesGrid />

      <LogoutConfirmModal
        open={logoutModalOpen}
        onOpenChange={setLogoutModalOpen}
        onConfirm={handleConfirmLogout}
        isLoggingOut={isLoggingOut}
      />
    </div>
  );
}
