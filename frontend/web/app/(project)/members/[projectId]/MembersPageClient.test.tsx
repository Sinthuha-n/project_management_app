import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import MembersPageClient from './MembersPageClient';
import axios from '@/lib/axios';
import { getUserFromToken } from '@/lib/auth';

jest.mock('next/image', () => ({
  __esModule: true,
  /* eslint-disable-next-line @next/next/no-img-element */
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt || ''} />,
}));

jest.mock('@/lib/auth', () => ({
  getUserFromToken: jest.fn(),
  getValidToken: jest.fn(),
}));

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

type Member = {
  id: number;
  role: string;
  user: {
    userId: number;
    username: string;
    fullName: string;
    email: string;
    profilePicUrl?: string;
  };
  taskCount: number;
  status: string;
  lastActive?: string;
};

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedGetUserFromToken = getUserFromToken as jest.Mock;

const membersFixture: Member[] = [
  {
    id: 1,
    role: 'ADMIN',
    user: { userId: 201, username: 'alice', fullName: 'Alice Admin', email: 'alice@example.com' },
    taskCount: 8,
    status: 'Active',
    lastActive: '2026-04-01T10:00:00.000Z',
  },
  {
    id: 2,
    role: 'MEMBER',
    user: { userId: 202, username: 'bob', fullName: 'Bob Member', email: 'bob@example.com' },
    taskCount: 3,
    status: 'Active',
    lastActive: '2026-04-01T11:00:00.000Z',
  },
  {
    id: 3,
    role: 'VIEWER',
    user: { userId: 203, username: 'carol', fullName: 'Carol Viewer', email: 'carol@example.com' },
    taskCount: 0,
    status: 'Active',
    lastActive: '2026-04-01T12:00:00.000Z',
  },
];

const ownerMembersFixture: Member[] = [
  {
    id: 1,
    role: 'OWNER',
    user: { userId: 201, username: 'alice', fullName: 'Alice Admin', email: 'alice@example.com' },
    taskCount: 8,
    status: 'Active',
    lastActive: '2026-04-01T10:00:00.000Z',
  },
  {
    id: 2,
    role: 'MEMBER',
    user: { userId: 202, username: 'bob', fullName: 'Bob Member', email: 'bob@example.com' },
    taskCount: 3,
    status: 'Active',
    lastActive: '2026-04-01T11:00:00.000Z',
  },
];

const pendingFixture = [
  {
    id: 300,
    email: 'invitee@example.com',
    invitedAt: '2026-04-01T14:00:00.000Z',
    status: 'Pending',
    role: 'MEMBER',
  },
];

const usersFixture = [
  {
    userId: 201,
    username: 'alice',
    fullName: 'Alice Admin',
    email: 'alice@example.com',
    profilePicUrl: '/avatars/alice.png',
  },
  {
    userId: 202,
    username: 'bob',
    fullName: 'Bob Member',
    email: 'bob@example.com',
    profilePicUrl: '/avatars/bob.png',
  },
];

const setupGetMocks = ({
  members = membersFixture,
  pending = pendingFixture,
  users = usersFixture,
  project = { id: 7, ownerId: 999, ownerName: 'Project Owner', name: 'Project Alpha' },
}: {
  members?: Member[];
  pending?: Array<{ id: number; email: string; invitedAt: string; status: string; role: string }>;
  users?: typeof usersFixture;
  project?: Record<string, unknown>;
}) => {
  mockedAxios.get.mockImplementation((url: string) => {
    if (url === '/api/projects/7') {
      return Promise.resolve({ data: project });
    }
    if (url === '/api/projects/7/members') {
      return Promise.resolve({ data: members });
    }
    if (url === '/api/projects/7/pending-invites') {
      return Promise.resolve({ data: pending });
    }
    if (url === '/api/auth/users') {
      return Promise.resolve({ data: users });
    }
    return Promise.resolve({ data: [] });
  });
};

describe('MembersPageClient', () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockedGetUserFromToken.mockReturnValue({ userId: 201, email: 'alice@example.com' });
    setupGetMocks({});
    mockedAxios.patch.mockResolvedValue({ data: {} });
    mockedAxios.post.mockResolvedValue({ data: {} });
    mockedAxios.delete.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('renders loading state then members table and stats', async () => {
    render(<MembersPageClient projectId="7" />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await screen.findByText('Team Members');
    expect(screen.getByText('Review who can access this project, adjust roles, and invite collaborators.')).toBeInTheDocument();
    expect(screen.getByText('Bob Member')).toBeInTheDocument();
    expect(screen.getByText('Total Members')).toBeInTheDocument();
  });

  it('supports search and role/status filter combinations', async () => {
    render(<MembersPageClient projectId="7" />);

    await screen.findByText('Alice Admin');

    fireEvent.change(screen.getByPlaceholderText('Search members by name or email...'), {
      target: { value: 'bob' },
    });

    expect(screen.getByText('Bob Member')).toBeInTheDocument();
    expect(screen.queryByText('Alice Admin')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search members by name or email...'), {
      target: { value: '' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'VIEWER' } });

    expect(screen.getByText('Carol Viewer')).toBeInTheDocument();
    expect(screen.queryByText('Bob Member')).not.toBeInTheDocument();
  });

  it('shows admin-only role options and updates role successfully', async () => {
    render(<MembersPageClient projectId="7" />);

    await screen.findByText('Bob Member');

    const roleSelect = screen
      .getAllByRole('combobox')
      .find((element) => (element as HTMLSelectElement).value === 'MEMBER');

    expect(roleSelect).toBeDefined();

    expect(within(roleSelect as HTMLElement).queryByRole('option', { name: 'Owner' })).not.toBeInTheDocument();
    expect(within(roleSelect as HTMLElement).queryByRole('option', { name: 'Admin' })).not.toBeInTheDocument();
    expect(within(roleSelect as HTMLElement).getByRole('option', { name: 'Member' })).toBeInTheDocument();
    expect(within(roleSelect as HTMLElement).getByRole('option', { name: 'Viewer' })).toBeInTheDocument();

    fireEvent.change(roleSelect as HTMLElement, { target: { value: 'VIEWER' } });

    await waitFor(() => {
      expect(mockedAxios.patch).toHaveBeenCalledWith('/api/projects/7/members/202/role', {
        role: 'VIEWER',
        userId: 202,
      });
      expect(screen.getByText('Role updated successfully!')).toBeInTheDocument();
    });
  });

  it('shows owner role options without owner assignment choice', async () => {
    setupGetMocks({ members: ownerMembersFixture });

    render(<MembersPageClient projectId="7" />);

    await screen.findByText('Bob Member');

    const roleSelect = screen
      .getAllByRole('combobox')
      .find((element) => (element as HTMLSelectElement).value === 'MEMBER');

    expect(roleSelect).toBeDefined();
    expect(within(roleSelect as HTMLElement).queryByRole('option', { name: 'Owner' })).not.toBeInTheDocument();
    expect(within(roleSelect as HTMLElement).getByRole('option', { name: 'Admin' })).toBeInTheDocument();
    expect(within(roleSelect as HTMLElement).getByRole('option', { name: 'Member' })).toBeInTheDocument();
    expect(within(roleSelect as HTMLElement).getByRole('option', { name: 'Viewer' })).toBeInTheDocument();
  });

  it('shows the project creator as owner even when the members endpoint returns another role', async () => {
    setupGetMocks({
      members: [
        {
          ...membersFixture[0],
          role: 'ADMIN',
          user: { ...membersFixture[0].user, userId: 201 },
        },
        membersFixture[1],
      ],
      project: { id: 7, ownerId: 201, ownerName: 'Alice Admin', name: 'Project Alpha' },
    });

    render(<MembersPageClient projectId="7" />);

    await screen.findByText('Alice Admin');

    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(
      screen.getAllByRole('combobox').some((element) => (element as HTMLSelectElement).value === 'ADMIN'),
    ).toBe(false);
  });

  it('resolves owner role from createdByUserId when ownerId is absent', async () => {
    setupGetMocks({
      members: [
        {
          ...membersFixture[0],
          role: 'ADMIN',
          user: { ...membersFixture[0].user, userId: 201 },
        },
        membersFixture[1],
      ],
      project: { id: 7, createdByUserId: 201, createdByUsername: 'alice', name: 'Project Alpha' },
    });

    render(<MembersPageClient projectId="7" />);

    await screen.findByText('Alice Admin');

    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(
      screen.getAllByRole('combobox').some((element) => (element as HTMLSelectElement).value === 'OWNER'),
    ).toBe(false);
  });

  it('renders owner rows as fixed badges even when the current owner email is unavailable', async () => {
    mockedGetUserFromToken.mockReturnValue({ userId: 201 });
    setupGetMocks({
      members: ownerMembersFixture,
      project: { id: 7, ownerId: 201, ownerName: 'Alice Admin', name: 'Project Alpha' },
    });

    render(<MembersPageClient projectId="7" />);

    await screen.findByText('Alice Admin');

    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(
      screen.getAllByRole('combobox').some((element) => (element as HTMLSelectElement).value === 'OWNER'),
    ).toBe(false);
  });

  it('removes a member after confirmation modal acceptance', async () => {
    render(<MembersPageClient projectId="7" />);

    await screen.findByText('Bob Member');

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

    const removeModal = screen.getByRole('dialog', { name: 'Remove Member' });
    expect(removeModal).toBeInTheDocument();
    fireEvent.click(within(removeModal).getByRole('button', { name: /Remove Member/i }));

    await waitFor(() => {
      expect(mockedAxios.delete).toHaveBeenCalledWith('/api/projects/7/members/202');
      expect(screen.queryByText('Bob Member')).not.toBeInTheDocument();
    });
  });

  it('handles invite modal success and failure scenarios', async () => {
    mockedAxios.post
      .mockRejectedValueOnce({ response: { data: { message: 'Invite failed' } } })
      .mockResolvedValueOnce({ data: {} });

    render(<MembersPageClient projectId="7" />);

    await screen.findByText('Team Members');

    fireEvent.click(screen.getByRole('button', { name: 'Invite Member' }));

    const inviteModal = screen.getByRole('dialog', { name: 'Invite Team Member' });
    expect(inviteModal).toBeInTheDocument();
    expect(within(inviteModal).queryByRole('option', { name: 'OWNER' })).not.toBeInTheDocument();

    fireEvent.change(within(inviteModal).getByRole('textbox'), {
      target: { value: 'newuser@example.com' },
    });
    fireEvent.change(within(inviteModal).getByRole('combobox'), {
      target: { value: 'MEMBER' },
    });
    fireEvent.click(within(inviteModal).getByRole('button', { name: /Send Invite/i }));

    await screen.findByText('Invite failed');

    fireEvent.click(within(inviteModal).getByRole('button', { name: /Send Invite/i }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenLastCalledWith('/api/projects/7/invitations', {
        email: 'newuser@example.com',
        role: 'MEMBER',
      });
    });
  });
});
