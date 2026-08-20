import { render, screen } from '@testing-library/react';
import TopBar from './TopBar';
import { usePathname, useRouter } from 'next/navigation';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock('@/lib/navigation-context', () => ({
  useNavigation: jest.fn(() => ({})),
}));

jest.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: jest.fn(() => ({ profilePicUrl: null })),
}));

jest.mock('@/lib/auth', () => ({
  getUserFromToken: jest.fn(() => ({ username: 'tester' })),
  getValidToken: jest.fn(() => 'token'),
}));

jest.mock('@/services/projects-service', () => ({
  fetchRecentProjects: jest.fn(),
  updateProjectDetails: jest.fn(),
}));

jest.mock('@/lib/url-utils', () => ({
  normalizeExternalUrl: jest.fn((url: string) => url),
  openSafeExternalUrl: jest.fn(),
}));

jest.mock('@/hooks/useProjectContext', () => ({
  subscribeToBrowserStorage: jest.fn(() => jest.fn()),
  useProjectContext: jest.fn(() => ({
    projectId: '123',
    projectName: 'Test Project',
    projectType: 'AGILE',
    isAgile: true,
    isFavorite: false,
    toggleFavorite: jest.fn(),
    switchProject: jest.fn(),
    figmaUrl: null,
    setFigmaUrl: jest.fn(),
    mutateProject: jest.fn(),
  })),
}));

jest.mock('./topbar/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

jest.mock('./topbar/GlobalSearch', () => ({
  __esModule: true,
  default: () => <div data-testid="global-search" />,
}));

jest.mock('./topbar/TabBar', () => ({
  TabBar: () => <nav data-testid="tab-bar" />,
}));

jest.mock('./sidebar/SpacesDropdown', () => ({
  SpacesDropdown: () => <div data-testid="spaces-dropdown" />,
}));

jest.mock('@/components/shared/ProjectTypeIcon', () => ({
  ProjectTypeIcon: () => <span data-testid="project-type-icon" />,
}));

jest.mock('@/components/ui/Modal', () => ({
  Modal: ({ children, open }: { children: React.ReactNode; open: boolean }) => (
    open ? <div data-testid="modal">{children}</div> : null
  ),
}));

const mockedUsePathname = usePathname as jest.Mock;
const mockedUseRouter = useRouter as jest.Mock;

describe('TopBar backlog task actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue({ push: jest.fn() });
  });

  it('hides the shared New Task button on the kanban backlog route', () => {
    mockedUsePathname.mockReturnValue('/backlog');

    render(<TopBar />);

    expect(screen.queryByRole('button', { name: /new task/i })).not.toBeInTheDocument();
  });

  it('keeps backlog actions on the sprint backlog route', () => {
    mockedUsePathname.mockReturnValue('/sprint-backlog');

    render(<TopBar />);

    expect(screen.getByRole('button', { name: /new task/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new sprint/i })).toBeInTheDocument();
  });
});
