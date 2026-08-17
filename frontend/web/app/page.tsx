'use client';

import Link from 'next/link';
import { ReactNode, useEffect, useState, useSyncExternalStore, useMemo } from 'react';
import { LogIn, UserPlus, LayoutDashboard, LogOut, ArrowRight, ChevronDown, Layers, Calendar, Users, Sparkles } from 'lucide-react';
import { PlanoraIcon, PlanoraLogo } from '@/components/brand/PlanoraLogo';
import { AUTH_TOKEN_CHANGED_EVENT, ensureValidToken, getUserFromToken, getValidToken, logout, User } from '@/lib/auth';
import { LogoutConfirmModal } from '@/components/auth/LogoutConfirmModal';
import { toast } from '@/components/ui/Toast';
import styles from './page.module.css';

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

  if (type === 'arrow-down') {
    return <ChevronDown size={14} className={`${color} shrink-0`} />;
  }

  return (
    <ArrowRight size={14} strokeWidth={2.5} className={`${color} ${hoverTransform} transition-transform shrink-0`} />
  );
}

interface ButtonProps {
  variant?: ButtonVariant;
  href?: string;
  onClick?: () => void;
  icon?: ArrowType;
  leadingIcon?: ReactNode;
  children: ReactNode;
  fullWidth?: boolean;
  className?: string;
  title?: string;
  ariaLabel?: string;
}

function Button({
  variant = 'primary',
  href,
  onClick,
  icon,
  leadingIcon,
  children,
  fullWidth = false,
  className = '',
  title,
  ariaLabel,
}: ButtonProps) {
  const baseClasses = 'h-9 sm:h-10 rounded-lg px-3 sm:px-5 cursor-pointer transition-all flex items-center justify-center gap-1.5 sm:gap-2 select-none';

  const variantClasses = {
    primary: 'bg-white text-[#1d56d5] shadow-md hover:shadow-lg hover:-translate-y-0.5 font-semibold text-xs sm:text-sm group active:scale-[0.98]',
    ghost: 'hover:bg-white/15 bg-white/10 border border-white/20 text-white font-medium text-xs sm:text-sm active:scale-[0.98] backdrop-blur-sm',
    outlined: 'bg-white/10 border border-white/30 hover:bg-white/20 backdrop-blur-sm text-white font-medium text-xs sm:text-sm active:scale-[0.98]',
  };

  const widthClass = fullWidth ? 'w-full sm:w-auto' : '';

  const content = (
    <div className={`${baseClasses} ${variantClasses[variant]} ${widthClass} ${className}`}>
      {leadingIcon && <span className="flex items-center justify-center shrink-0">{leadingIcon}</span>}
      <span className="whitespace-nowrap">{children}</span>
      {icon && <ArrowIcon type={icon} variant={variant} />}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={widthClass} title={title} aria-label={ariaLabel}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${widthClass} bg-transparent border-0 p-0 text-left cursor-pointer`}
      title={title}
      aria-label={ariaLabel}
    >
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
    : 'bg-white/20 rounded-xl w-11 h-11 flex items-center justify-center mb-3 text-white';

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
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-medium backdrop-blur-sm transition-all"
          title={`Signed in as ${displayName}`}
        >
          <div className="w-6 h-6 rounded-full bg-white/25 flex items-center justify-center font-bold text-white text-[11px] ring-1 ring-white/30">
            {initial}
          </div>
          <span className="max-w-[120px] truncate">{displayName}</span>
        </Link>

        {/* Dashboard link */}
        <Button
          variant="primary"
          href="/dashboard"
          icon="arrow-right"
          leadingIcon={<LayoutDashboard size={15} strokeWidth={2.2} />}
          title="Open Dashboard"
          ariaLabel="Dashboard"
        >
          Dashboard
        </Button>

        {/* Log Out button */}
        <Button
          variant="ghost"
          onClick={onLogoutClick}
          leadingIcon={<LogOut size={15} strokeWidth={2.2} />}
          title="Log out of Planora"
          ariaLabel="Log Out"
        >
          Log Out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2 sm:gap-3 items-center">
      <Button
        variant="ghost"
        href="/login"
        leadingIcon={<LogIn size={15} strokeWidth={2.2} />}
        title="Sign in to your account"
        ariaLabel="Sign In"
      >
        Sign In
      </Button>
      <Button
        variant="primary"
        href="/register"
        leadingIcon={<UserPlus size={15} strokeWidth={2.2} />}
        title="Create a new Planora account"
        ariaLabel="Get Started"
      >
        Get Started
      </Button>
    </div>
  );
}

function Navigation({ user, onLogoutClick }: NavButtonsProps) {
  return (
    <div className="bg-white/10 w-full border-b border-white/20">
      <div className="h-16 sm:h-[72px] w-full flex items-center justify-between px-3 sm:px-6 md:px-8">
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
        <p className="font-semibold text-[10px] sm:text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles size={13} className="text-yellow-300 animate-pulse" /> The Future of Project Management
        </p>
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
            <Button
              variant="primary"
              href="/dashboard"
              icon="arrow-right"
              leadingIcon={<LayoutDashboard size={16} strokeWidth={2.2} />}
              fullWidth
            >
              Go to Dashboard
            </Button>
            <Button variant="outlined" href="#features" icon="arrow-down" fullWidth>
              Learn More
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              href="/register"
              icon="arrow-right"
              leadingIcon={<UserPlus size={16} strokeWidth={2.2} />}
              fullWidth
            >
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
        icon={<Layers size={22} />}
        title="Smart Backlogs"
        desc="Organize your work with intelligent backlogs, sprints, and automated task management."
      />
      <FeatureCard
        icon={<Calendar size={22} />}
        title="Timeline & Calendar"
        desc="Visualize your project lifecycle. Track deadlines, milestones, and team velocity at a glance."
      />
      <FeatureCard
        icon={<Users size={22} />}
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
