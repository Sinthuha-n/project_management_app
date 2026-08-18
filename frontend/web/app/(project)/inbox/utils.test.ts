import type { ChatInboxActivity, ChatInboxProjectGroup, ChatInboxResponse } from '@/services/chat-service';
import {
  buildChatHref,
  getPageNumbers,
  markActivityAsRead,
  markAllActivitiesAsRead,
  paginateProjectGroups,
} from './utils';

function createActivity(overrides: Partial<ChatInboxActivity> = {}): ChatInboxActivity {
  return {
    projectId: 12,
    projectName: 'Alpha',
    chatType: 'TEAM',
    unseenCount: 3,
    unread: true,
    activityStatus: 'UNREAD',
    ...overrides,
  };
}

function createState(activities: ChatInboxActivity[]): ChatInboxResponse {
  return {
    projects: [
      {
        projectId: 12,
        projectName: 'Alpha',
        unreadCount: activities.reduce((sum, item) => sum + (item.unread ? item.unseenCount : 0), 0),
        totalItems: activities.length,
        activities,
      },
    ],
    recentActivities: activities,
    totalProjects: 1,
    totalActivities: activities.length,
    totalUnread: activities.reduce((sum, item) => sum + (item.unread ? item.unseenCount : 0), 0),
  };
}

describe('inbox utils', () => {
  it('builds chat href for team, room, and direct chats', () => {
    expect(buildChatHref(createActivity({ chatType: 'TEAM' }))).toBe('/project/12/chat?view=team');
    expect(buildChatHref(createActivity({ chatType: 'ROOM', roomId: 5 }))).toBe('/project/12/chat?roomId=5');
    expect(buildChatHref(createActivity({ chatType: 'DIRECT', username: 'jane doe' }))).toBe('/project/12/chat?with=jane%20doe');
  });

  it('marks only the target activity as read', () => {
    const team = createActivity({ chatType: 'TEAM', unseenCount: 2 });
    const room = createActivity({ chatType: 'ROOM', roomId: 7, unseenCount: 4 });
    const state = createState([team, room]);

    const next = markActivityAsRead(state, room);

    expect(next?.projects[0].activities[0].unread).toBe(true);
    expect(next?.projects[0].activities[1].unread).toBe(false);
    expect(next?.projects[0].activities[1].unseenCount).toBe(0);
  });

  it('marks all activities as read', () => {
    const team = createActivity({ chatType: 'TEAM', unseenCount: 2 });
    const direct = createActivity({ chatType: 'DIRECT', username: 'sara', unseenCount: 1 });
    const state = createState([team, direct]);

    const next = markAllActivitiesAsRead(state);

    expect(next?.totalUnread).toBe(0);
    expect(next?.projects[0].unreadCount).toBe(0);
    expect(next?.projects[0].activities.every((item) => !item.unread)).toBe(true);
  });

  describe('getPageNumbers', () => {
    it('returns empty array when totalPages <= 0', () => {
      expect(getPageNumbers(1, 0)).toEqual([]);
      expect(getPageNumbers(1, -3)).toEqual([]);
    });

    it('returns all pages when totalPages <= maxVisible', () => {
      expect(getPageNumbers(1, 5, 7)).toEqual([1, 2, 3, 4, 5]);
      expect(getPageNumbers(3, 7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('returns start block with ellipsis at end when near the start', () => {
      expect(getPageNumbers(1, 10, 7)).toEqual([1, 2, 3, 4, 5, '...', 10]);
      expect(getPageNumbers(4, 10, 7)).toEqual([1, 2, 3, 4, 5, '...', 10]);
    });

    it('returns end block with ellipsis at start when near the end', () => {
      expect(getPageNumbers(7, 10, 7)).toEqual([1, '...', 6, 7, 8, 9, 10]);
      expect(getPageNumbers(10, 10, 7)).toEqual([1, '...', 6, 7, 8, 9, 10]);
    });

    it('returns middle block with ellipses on both sides', () => {
      expect(getPageNumbers(5, 10, 7)).toEqual([1, '...', 4, 5, 6, '...', 10]);
      expect(getPageNumbers(6, 12, 7)).toEqual([1, '...', 5, 6, 7, '...', 12]);
    });
  });

  describe('paginateProjectGroups', () => {
    const sampleGroups: ChatInboxProjectGroup[] = [
      { projectId: 1, projectName: 'Project 1', unreadCount: 0, totalItems: 1, activities: [] },
      { projectId: 2, projectName: 'Project 2', unreadCount: 0, totalItems: 1, activities: [] },
      { projectId: 3, projectName: 'Project 3', unreadCount: 0, totalItems: 1, activities: [] },
      { projectId: 4, projectName: 'Project 4', unreadCount: 0, totalItems: 1, activities: [] },
      { projectId: 5, projectName: 'Project 5', unreadCount: 0, totalItems: 1, activities: [] },
    ];

    it('returns full array if pageSize <= 0', () => {
      expect(paginateProjectGroups(sampleGroups, 1, 0)).toEqual(sampleGroups);
      expect(paginateProjectGroups(sampleGroups, 1, -1)).toEqual(sampleGroups);
    });

    it('paginates groups properly by page and pageSize', () => {
      const page1 = paginateProjectGroups(sampleGroups, 1, 2);
      expect(page1.map((p) => p.projectId)).toEqual([1, 2]);

      const page2 = paginateProjectGroups(sampleGroups, 2, 2);
      expect(page2.map((p) => p.projectId)).toEqual([3, 4]);

      const page3 = paginateProjectGroups(sampleGroups, 3, 2);
      expect(page3.map((p) => p.projectId)).toEqual([5]);
    });

    it('handles out of bound pages safely', () => {
      const outOfBounds = paginateProjectGroups(sampleGroups, 10, 2);
      expect(outOfBounds).toEqual([]);
    });
  });
});

