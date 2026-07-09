import type { Href } from 'expo-router';

export type ProjectMainTab = 'summary' | 'backlog' | 'board' | 'chat';
export type ProjectMoreTab =
  | 'timeline'
  | 'calendar'
  | 'burndown'
  | 'milestone'
  | 'members'
  | 'pages'
  | 'docs'
  | 'list'
  | 'report';

export type NotificationRouteData = Record<string, unknown> | undefined;

const PROJECT_MORE_BY_WEB_SEGMENT: Record<string, ProjectMoreTab> = {
  timeline: 'timeline',
  calendar: 'calendar',
  burndown: 'burndown',
  milestones: 'milestone',
  milestone: 'milestone',
  members: 'members',
  pages: 'pages',
  docs: 'docs',
  folders: 'docs',
  list: 'list',
  report: 'report',
  reports: 'report',
};

const PROJECT_MAIN_BY_WEB_SEGMENT: Record<string, ProjectMainTab> = {
  summary: 'summary',
  backlog: 'backlog',
  board: 'board',
  kanban: 'board',
  chat: 'chat',
};

export const routes = {
  landing: '/' as Href,
  tabs: '/(tabs)' as Href,
  login: '/(auth)/login' as Href,
  register: '/(auth)/register' as Href,
  notifications: '/dashboard/notifications' as Href,
  profile: '/(tabs)/profile' as Href,
  spaces: '/(tabs)/spaces' as Href,
  inbox: '/(tabs)/inbox' as Href,
  createProject: '/create-project' as Href,
  portfolios: '/portfolios' as Href,
  acceptInvite: (token?: string): Href =>
    token ? (`/accept-invite?token=${encodeURIComponent(token)}` as Href) : ('/accept-invite' as Href),
  project: (projectId: number | string, tab?: ProjectMainTab, more?: ProjectMoreTab): Href => {
    const params = new URLSearchParams();
    if (tab && tab !== 'summary') params.set('tab', tab);
    if (more) params.set('more', more);
    const qs = params.toString();
    return (`/summary/${projectId}${qs ? `?${qs}` : ''}`) as Href;
  },
  github: (projectId: number | string): Href => `/github/${projectId}` as Href,
  settings: (projectId: number | string, projectName?: string): Href => {
    const qs = projectName ? `?projectName=${encodeURIComponent(projectName)}` : '';
    return `/project/${projectId}/settings${qs}` as Href;
  },
};

export function normalizeRouteLink(link: string): string {
  const trimmed = link.trim();
  if (!trimmed) return '/';

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      return `${url.pathname}${url.search}${url.hash}` || '/';
    } catch {
      return trimmed;
    }
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function projectRouteFromWebPath(pathname: string, searchParams: URLSearchParams): Href | null {
  const segments = pathname.split('/').filter(Boolean);
  const projectId =
    searchParams.get('projectId') ||
    searchParams.get('project') ||
    segments.find((segment, index) => index > 0 && /^\d+$/.test(segment));

  if (!projectId) return null;

  const lastSegment = segments[segments.length - 1] ?? '';
  const firstProjectSegment = segments.find((segment) =>
    PROJECT_MAIN_BY_WEB_SEGMENT[segment] || PROJECT_MORE_BY_WEB_SEGMENT[segment]
  );
  const segment = PROJECT_MAIN_BY_WEB_SEGMENT[lastSegment] || PROJECT_MORE_BY_WEB_SEGMENT[lastSegment]
    ? lastSegment
    : firstProjectSegment;

  if (segment && PROJECT_MAIN_BY_WEB_SEGMENT[segment]) {
    return routes.project(projectId, PROJECT_MAIN_BY_WEB_SEGMENT[segment]);
  }
  if (segment && PROJECT_MORE_BY_WEB_SEGMENT[segment]) {
    return routes.project(projectId, 'summary', PROJECT_MORE_BY_WEB_SEGMENT[segment]);
  }

  return routes.project(projectId);
}

export function resolveMobileRoute(rawLink: string): Href | null {
  const normalized = normalizeRouteLink(rawLink);
  let pathname = normalized;
  let searchParams = new URLSearchParams();

  try {
    const parsed = new URL(normalized, 'https://planora.local');
    pathname = parsed.pathname;
    searchParams = parsed.searchParams;
  } catch {
    const [path, query = ''] = normalized.split('?');
    pathname = path;
    searchParams = new URLSearchParams(query);
  }

  const inviteToken = searchParams.get('token') || searchParams.get('inviteToken');
  if (pathname.includes('accept-invite') || pathname.includes('invitations/accept')) {
    return routes.acceptInvite(inviteToken ?? undefined);
  }

  if (pathname.startsWith('/dashboard/notifications') || pathname.startsWith('/notifications')) {
    return routes.notifications;
  }
  if (pathname.startsWith('/portfolios')) return normalized as Href;
  if (pathname.startsWith('/create-project') || pathname.startsWith('/createProject')) return routes.createProject;
  if (pathname.startsWith('/github/')) return normalized as Href;
  if (pathname.startsWith('/summary/')) return normalized as Href;
  if (pathname.startsWith('/board/')) {
    const projectId = pathname.split('/').filter(Boolean)[1];
    return projectId ? routes.project(projectId, 'board') : null;
  }
  if (pathname.startsWith('/project/') && pathname.includes('/settings')) return normalized as Href;
  if (pathname.startsWith('/(tabs)')) return normalized as Href;

  return projectRouteFromWebPath(pathname, searchParams);
}

export function resolveNotificationRoute(data: NotificationRouteData): Href | null {
  const rawLink = typeof data?.link === 'string' ? data.link : null;
  if (rawLink) {
    const route = resolveMobileRoute(rawLink);
    if (route) return route;
  }

  const projectId = stringValue(data?.projectId);
  if (!projectId) return null;

  const eventType = typeof data?.eventType === 'string' ? data.eventType.toUpperCase() : '';
  const entityType = typeof data?.entityType === 'string' ? data.entityType.toUpperCase() : '';
  const message = typeof data?.message === 'string' ? data.message.toLowerCase() : '';

  if (eventType.includes('CHAT') || entityType === 'CHAT' || message.includes('chat')) {
    return routes.project(projectId, 'chat');
  }
  if (eventType.includes('GITHUB') || entityType === 'GITHUB' || message.includes('github')) {
    return routes.github(projectId);
  }
  if (eventType.includes('PAGE') || entityType === 'PAGE' || message.includes('page')) {
    return routes.project(projectId, 'summary', 'pages');
  }
  if (eventType.includes('DOCUMENT') || entityType === 'DOCUMENT' || message.includes('document')) {
    return routes.project(projectId, 'summary', 'docs');
  }
  if (eventType.includes('REPORT') || entityType === 'REPORT' || message.includes('report')) {
    return routes.project(projectId, 'summary', 'report');
  }
  if (eventType.includes('TASK') || entityType === 'TASK' || message.includes('task')) {
    return routes.project(projectId, 'board');
  }

  return routes.project(projectId);
}
