'use client';

import Link from 'next/link';
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarRange,
  Check,
  ChevronDown,
  Columns3,
  GitBranch,
  Layers,
  LayoutDashboard,
  LogIn,
  LogOut,
  MonitorSmartphone,
  MousePointer2,
  Sparkles,
  UserPlus,
  Zap,
} from 'lucide-react';
import { PlanoraIcon, PlanoraLogo } from '@/components/brand/PlanoraLogo';
import {
  AUTH_TOKEN_CHANGED_EVENT,
  ensureValidToken,
  getUserFromToken,
  getValidToken,
  logout,
  User,
} from '@/lib/auth';
import { LogoutConfirmModal } from '@/components/auth/LogoutConfirmModal';
import { toast } from '@/components/ui/Toast';
import styles from './page.module.css';

/* ── Buttons ─────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'ghost' | 'onBrand' | 'onBrandGhost';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: styles.btnPrimary,
  ghost: styles.btnGhost,
  onBrand: styles.btnOnBrand,
  onBrandGhost: styles.btnOnBrandGhost,
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: styles.btnSm,
  md: '',
  lg: styles.btnLg,
};

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  onClick?: () => void;
  trailing?: 'arrow-right' | 'arrow-down';
  leadingIcon?: ReactNode;
  children: ReactNode;
  title?: string;
  ariaLabel?: string;
}

function Button({
  variant = 'primary',
  size = 'md',
  href,
  onClick,
  trailing,
  leadingIcon,
  children,
  title,
  ariaLabel,
}: ButtonProps) {
  const className = `${styles.btn} ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]}`.trim();

  const inner = (
    <>
      {leadingIcon ? <span className={styles.btnIcon}>{leadingIcon}</span> : null}
      <span>{children}</span>
      {trailing === 'arrow-right' ? (
        <ArrowRight size={15} strokeWidth={2.4} className={`${styles.btnIcon} ${styles.btnArrow}`} />
      ) : null}
      {trailing === 'arrow-down' ? (
        <ChevronDown size={15} strokeWidth={2.4} className={styles.btnIcon} />
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} title={title} aria-label={ariaLabel}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} title={title} aria-label={ariaLabel}>
      {inner}
    </button>
  );
}

/* ── Auth token subscription ─────────────────────────────────── */

const subscribeToBrowserStorage = (onChange: () => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', onChange);
  window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, onChange);
  };
};

/* ── Scroll reveal ───────────────────────────────────────────── */

/**
 * Reveals every `[data-reveal]` node as it enters the viewport.
 * Where IntersectionObserver is unavailable (SSR-less test envs, very old
 * browsers) the page is composed immediately rather than staying invisible.
 */
function useScrollReveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (nodes.length === 0) return;

    const revealAll = () => nodes.forEach((node) => node.classList.add(styles.revealVisible));

    if (typeof IntersectionObserver === 'undefined') {
      revealAll();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add(styles.revealVisible);
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

/** Adds the glass treatment to the nav once the page has moved. */
function useScrolledPastTop(offset = 8) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => setScrolled(window.scrollY > offset);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [offset]);

  return scrolled;
}

type RevealProps = { delay?: number };

/** Inline custom property carrying a per-element reveal delay. */
function revealStyle(delay?: number): CSSProperties | undefined {
  if (!delay) return undefined;
  return { '--reveal-delay': `${delay}ms` } as CSSProperties;
}

/* ── Navigation ──────────────────────────────────────────────── */

function BrandLockup() {
  return (
    <div className="flex items-center">
      <span className="hidden sm:block">
        <PlanoraLogo width={132} />
      </span>
      <span className="block sm:hidden">
        <PlanoraIcon size={30} title="Planora" />
      </span>
    </div>
  );
}

interface NavProps {
  user: User | null;
  onLogoutClick: () => void;
}

function NavActions({ user, onLogoutClick }: NavProps) {
  if (user) {
    const displayName = user.username || user.fullName || 'Account';
    const initial = displayName.charAt(0).toUpperCase();

    return (
      <div className="flex items-center gap-2 sm:gap-2.5">
        <Link href="/profile" className={styles.profilePill} title={`Signed in as ${displayName}`}>
          <span className={styles.avatar} aria-hidden="true">
            {initial}
          </span>
          <span className={styles.profileName}>{displayName}</span>
        </Link>

        <Button
          variant="primary"
          size="sm"
          href="/dashboard"
          trailing="arrow-right"
          leadingIcon={<LayoutDashboard size={15} strokeWidth={2.2} />}
          title="Open Dashboard"
          ariaLabel="Dashboard"
        >
          Dashboard
        </Button>

        <Button
          variant="ghost"
          size="sm"
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
    <div className="flex items-center gap-2 sm:gap-2.5">
      <Button
        variant="ghost"
        size="sm"
        href="/login"
        leadingIcon={<LogIn size={15} strokeWidth={2.2} />}
        title="Sign in to your account"
        ariaLabel="Sign In"
      >
        Sign In
      </Button>
      <Button
        variant="primary"
        size="sm"
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

function Navigation({ user, onLogoutClick }: NavProps) {
  const scrolled = useScrolledPastTop();

  return (
    <header className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
      <div className={styles.navInner}>
        <BrandLockup />

        <nav className={styles.navLinks} aria-label="Page sections">
          <a href="#features" className={styles.navLink}>
            Features
          </a>
          <a href="#workflow" className={styles.navLink}>
            How it works
          </a>
        </nav>

        <NavActions user={user} onLogoutClick={onLogoutClick} />
      </div>
    </header>
  );
}

/* ── Product mockup ──────────────────────────────────────────── */

type MockTask = { tag: string; avatar: string; done?: boolean };

function TaskCard({ tag, avatar, done, className }: MockTask & { className?: string }) {
  return (
    <div className={`${styles.taskCard} ${className ?? ''}`.trim()}>
      <span className={styles.taskTag} style={{ background: tag }} />
      <span className={styles.taskBar} />
      <div className={styles.taskFoot}>
        <span className={styles.taskAvatar} style={{ background: avatar }} />
        <span className={styles.taskMeta} />
        {done ? (
          <span className={styles.taskCheck}>
            <Check size={11} strokeWidth={3.2} />
          </span>
        ) : null}
      </div>
    </div>
  );
}

function MockColumn({
  name,
  dot,
  count,
  children,
}: {
  name: string;
  dot: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className={styles.column}>
      <div className={styles.columnHead}>
        <span className={styles.columnDot} style={{ background: dot }} />
        <span className={styles.columnName}>{name}</span>
        <span className={styles.columnCount}>{count}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * A miniature of the real product: sprint board, rail, sprint progress.
 * The card in "In progress" picks itself up and ships on an eight-second
 * loop — the page demonstrating the thing the copy is claiming.
 */
function ProductMockup() {
  return (
    <div className={styles.mockupWrap} data-reveal style={revealStyle(220)}>
      <div className={styles.mockupGlow} aria-hidden="true" />

      <div className={styles.mockup} role="img" aria-label="A Planora sprint board with tasks moving from in progress to done">
        <div className={styles.mockupChrome}>
          <div className={styles.chromeDots} aria-hidden="true">
            <span className={styles.chromeDot} />
            <span className={styles.chromeDot} />
            <span className={styles.chromeDot} />
          </div>
          <span className={styles.chromeTitle}>Planora · Sprint 24 · Board</span>
          <div className={styles.chromeAvatars} aria-hidden="true">
            <span className={styles.chromeAvatar} style={{ background: '#155DFC' }} />
            <span className={styles.chromeAvatar} style={{ background: '#9810FA' }} />
            <span className={styles.chromeAvatar} style={{ background: '#F6339A' }} />
          </div>
        </div>

        <div className={styles.mockupBody}>
          <aside className={styles.mockupRail} aria-hidden="true">
            <span className={`${styles.railItem} ${styles.railItemActive}`} />
            <span className={styles.railItem} />
            <span className={styles.railItem} />
            <span className={styles.railItem} />
            <span className={styles.railItem} />
          </aside>

          <div className={styles.board} aria-hidden="true">
            <MockColumn name="To do" dot="#D3D3D3" count={5}>
              <TaskCard tag="#155DFC" avatar="#155DFC" />
              <TaskCard tag="#FF9F43" avatar="#9810FA" />
              <TaskCard tag="#D3D3D3" avatar="#F6339A" />
            </MockColumn>

            <MockColumn name="In progress" dot="#155DFC" count={3}>
              <div className={styles.flySlot}>
                <span className={styles.ghostSlot} />
                <div className={styles.flyCard}>
                  <TaskCard tag="#9810FA" avatar="#155DFC" />
                  <span className={styles.cursor}>
                    <MousePointer2 size={13} strokeWidth={2.4} fill="#9810FA" color="#9810FA" />
                    <span className={styles.cursorLabel}>Maya</span>
                  </span>
                </div>
              </div>
              <TaskCard tag="#155DFC" avatar="#F6339A" />
            </MockColumn>

            <MockColumn name="Done" dot="#6BC950" count={8}>
              <TaskCard tag="#6BC950" avatar="#9810FA" done />
            </MockColumn>
          </div>
        </div>

        <div className={styles.mockupFoot}>
          <span className={styles.footLabel}>Sprint progress</span>
          <span className={styles.progressTrack} aria-hidden="true">
            <span className={styles.progressFill} />
          </span>
          <span className={styles.footLabel}>6 days left</span>
        </div>
      </div>
    </div>
  );
}

/* ── Hero ────────────────────────────────────────────────────── */

function Hero({ user }: { user: User | null }) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroBadge} data-reveal>
        <Sparkles size={13} className="text-[#9810FA]" strokeWidth={2.2} />
        <span>One workspace for the whole delivery cycle</span>
        <span className={styles.heroBadgeDot}>Plan · Track · Ship</span>
      </div>

      <h1 className={styles.heroTitle} data-reveal style={revealStyle(80)}>
        <span className={styles.heroLine}>Plan the sprint.</span>
        <span className={styles.heroLine}>Track the work.</span>
        <span className={`${styles.heroLine} ${styles.gradientText}`}>Ship on time.</span>
      </h1>

      <p className={styles.heroLead} data-reveal style={revealStyle(150)}>
        Planora keeps your backlog, sprint board, timeline and reports in a single place — so the
        whole team can see where the work stands without asking for a status update.
      </p>

      <div className={styles.heroActions} data-reveal style={revealStyle(210)}>
        {user ? (
          <>
            <Button
              variant="primary"
              size="lg"
              href="/dashboard"
              trailing="arrow-right"
              leadingIcon={<LayoutDashboard size={16} strokeWidth={2.2} />}
            >
              Go to Dashboard
            </Button>
            <Button variant="ghost" size="lg" href="#features" trailing="arrow-down">
              Learn More
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              size="lg"
              href="/register"
              trailing="arrow-right"
              leadingIcon={<UserPlus size={16} strokeWidth={2.2} />}
            >
              Get Started
            </Button>
            <Button variant="ghost" size="lg" href="#features" trailing="arrow-down">
              Learn More
            </Button>
          </>
        )}
      </div>

      <ul className={styles.heroNotes} data-reveal style={revealStyle(270)}>
        <li className={styles.heroNote}>
          <Zap size={14} strokeWidth={2.2} className="text-[#155DFC]" />
          Set up in minutes
        </li>
        <li className={styles.heroNote}>
          <MonitorSmartphone size={14} strokeWidth={2.2} className="text-[#9810FA]" />
          Installs on desktop and mobile
        </li>
        <li className={styles.heroNote}>
          <Check size={14} strokeWidth={2.6} className="text-[#F6339A]" />
          Keeps working offline
        </li>
      </ul>
    </section>
  );
}

/* ── Capability marquee ──────────────────────────────────────── */

const CAPABILITIES = [
  'Backlog',
  'Sprint board',
  'Burndown',
  'Kanban',
  'Timeline',
  'Calendar',
  'List view',
  'Milestones',
  'Workload',
  'Reports',
  'Portfolios',
  'Spaces & folders',
  'GitHub sync',
  'Inbox',
  'Members & roles',
];

function CapabilityMarquee() {
  return (
    <section className={styles.marqueeSection} data-reveal aria-label="What is included">
      <p className={styles.marqueeLabel}>Everything the delivery cycle needs</p>
      <div className={styles.marquee}>
        <div className={styles.marqueeTrack}>
          {[...CAPABILITIES, ...CAPABILITIES].map((label, index) => (
            <span
              className={styles.chip}
              key={`${label}-${index}`}
              aria-hidden={index >= CAPABILITIES.length}
            >
              <span className={styles.chipDot} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Features ────────────────────────────────────────────────── */

const FEATURES: { icon: ReactNode; title: string; desc: string }[] = [
  {
    icon: <Columns3 size={21} strokeWidth={2.1} />,
    title: 'Backlog and sprint boards',
    desc: 'Groom the backlog, size the work, pull it into a sprint, then drag it across the board. Sprint backlog, board and burndown all read from the same source.',
  },
  {
    icon: <CalendarRange size={21} strokeWidth={2.1} />,
    title: 'Timeline and calendar',
    desc: 'Lay milestones and deadlines out on a timeline to spot the crunch early, or drop into the calendar when you only care about this week.',
  },
  {
    icon: <Layers size={21} strokeWidth={2.1} />,
    title: 'Spaces, folders, portfolios',
    desc: 'Structure work the way your organisation actually works — spaces and folders for the teams, portfolios for the roll-up leadership asks for.',
  },
  {
    icon: <BarChart3 size={21} strokeWidth={2.1} />,
    title: 'Workload and reports',
    desc: 'See who is overloaded before they say so, and answer "are we on track?" with burndown charts and project reports instead of a spreadsheet.',
  },
  {
    icon: <GitBranch size={21} strokeWidth={2.1} />,
    title: 'GitHub, connected',
    desc: 'Link branches, commits and pull requests to the tasks they belong to, so engineering progress shows up on the board on its own.',
  },
  {
    icon: <Bell size={21} strokeWidth={2.1} />,
    title: 'Live inbox and alerts',
    desc: 'Mentions, assignments and status changes arrive in real time, in a single inbox — on the web, on your desktop and on your phone.',
  },
];

function FeatureCard({ icon, title, desc, delay }: (typeof FEATURES)[number] & RevealProps) {
  const handleSpotlight = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    const card = event.currentTarget;
    const bounds = card.getBoundingClientRect();
    card.style.setProperty('--spot-x', `${event.clientX - bounds.left}px`);
    card.style.setProperty('--spot-y', `${event.clientY - bounds.top}px`);
  }, []);

  return (
    <article
      className={styles.featureCard}
      data-reveal
      style={revealStyle(delay)}
      onMouseMove={handleSpotlight}
    >
      <span className={styles.featureIcon} aria-hidden="true">
        {icon}
      </span>
      <h3 className={styles.featureTitle}>{title}</h3>
      <p className={styles.featureDesc}>{desc}</p>
    </article>
  );
}

function Features() {
  return (
    <section id="features" className={`${styles.section} ${styles.features}`}>
      <div className={styles.sectionHead} data-reveal>
        <span className={styles.eyebrow}>
          <Sparkles size={12} strokeWidth={2.4} />
          Built for delivery teams
        </span>
        <h2 className={styles.sectionTitle}>
          Every view your team needs, <span className={styles.gradientText}>none of the sprawl</span>
        </h2>
        <p className={styles.sectionLead}>
          Planning, tracking and reporting stop being three different tools once they share one
          workspace — and one set of tasks underneath.
        </p>
      </div>

      <div className={styles.featureGrid}>
        {FEATURES.map((feature, index) => (
          <FeatureCard key={feature.title} {...feature} delay={index * 70} />
        ))}
      </div>
    </section>
  );
}

/* ── Workflow ────────────────────────────────────────────────── */

const STEPS = [
  {
    title: 'Plan',
    desc: 'Capture work in the backlog, give it an estimate and an owner, then pull the sprint together in one pass.',
  },
  {
    title: 'Track',
    desc: 'Move cards across the board as the work happens. Timeline, workload and burndown update themselves.',
  },
  {
    title: 'Ship',
    desc: 'Close the sprint with a report that shows exactly what landed — and what is carrying over.',
  },
];

function Workflow() {
  return (
    <section id="workflow" className={`${styles.section} ${styles.workflow}`}>
      <div className={styles.sectionHead} data-reveal>
        <span className={styles.eyebrow}>How it works</span>
        <h2 className={styles.sectionTitle}>
          Three steps, <span className={styles.gradientText}>one loop</span>
        </h2>
        <p className={styles.sectionLead}>
          The same cycle every sprint, with the reporting falling out of the work instead of being
          assembled afterwards.
        </p>
      </div>

      <div className={styles.steps}>
        {STEPS.map((step, index) => (
          <div className={styles.step} key={step.title} data-reveal style={revealStyle(index * 110)}>
            <span className={styles.stepNumber}>
              <span className={styles.stepPulse} aria-hidden="true" />
              {index + 1}
            </span>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepDesc}>{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Closing CTA ─────────────────────────────────────────────── */

function ClosingCta({ user }: { user: User | null }) {
  return (
    <section className={`${styles.section} ${styles.ctaSection}`}>
      <div className={styles.ctaPanel} data-reveal>
        <span className={styles.ctaGrid} aria-hidden="true" />
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>
            {user ? 'Your workspace is waiting' : 'Start planning your next sprint'}
          </h2>
          <p className={styles.ctaLead}>
            {user
              ? 'Pick up exactly where your team left off — the board, the timeline and the numbers are already up to date.'
              : 'Create a workspace, invite the team and run your first sprint today. Nothing to install, nothing to configure.'}
          </p>
          <div className={styles.ctaActions}>
            {user ? (
              <Button variant="onBrand" size="lg" href="/dashboard" trailing="arrow-right">
                Open your workspace
              </Button>
            ) : (
              <>
                <Button variant="onBrand" size="lg" href="/register" trailing="arrow-right">
                  Create your workspace
                </Button>
                <Button variant="onBrandGhost" size="lg" href="#features">
                  Explore the features
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ──────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <PlanoraLogo width={130} animated={false} />
          <p className={styles.footerTagline}>
            A project management workspace for teams that plan, track and ship together.
          </p>
        </div>

        <nav className={styles.footerLinks} aria-label="Footer">
          <a href="#features" className={styles.footerLink}>
            Features
          </a>
          <a href="#workflow" className={styles.footerLink}>
            How it works
          </a>
        </nav>
      </div>

      <div className={styles.footerBar}>
        <p className={styles.footerBarInner}>
          © {new Date().getFullYear()} Planora. Plan · Track · Ship.
        </p>
      </div>
    </footer>
  );
}

/* ── Page ────────────────────────────────────────────────────── */

export default function Page() {
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [asyncUser, setAsyncUser] = useState<User | null>(null);

  useScrollReveal();

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
    <div className={styles.page}>
      <div className={styles.ambient} aria-hidden="true">
        <span className={styles.dotGrid} />
        <span className={`${styles.blob} ${styles.blobOne} animate-float-slow`} />
        <span className={`${styles.blob} ${styles.blobTwo} animate-float-delayed`} />
        <span className={`${styles.blob} ${styles.blobThree} animate-float-medium`} />
      </div>

      <div className={styles.shell}>
        <Navigation user={currentUser} onLogoutClick={handleOpenLogout} />

        <main>
          <Hero user={currentUser} />
          <ProductMockup />
          <CapabilityMarquee />
          <Features />
          <Workflow />
          <ClosingCta user={currentUser} />
        </main>

        <Footer />
      </div>

      <LogoutConfirmModal
        open={logoutModalOpen}
        onOpenChange={setLogoutModalOpen}
        onConfirm={handleConfirmLogout}
        isLoggingOut={isLoggingOut}
      />
    </div>
  );
}
