import type { Notification } from '@/services/notifications-service';
import {
  extractTaskIdFromLink,
  formatRelativeTime,
  getPageNumbers,
  hasActionLink,
  inferNotificationType,
  paginateNotifications,
  toTypeLabel,
} from './utils';

const buildNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 1,
  message: 'Test message',
  read: false,
  createdAt: '2026-04-10T10:00:00.000Z',
  ...overrides,
});

describe('notifications utils', () => {
  describe('inferNotificationType', () => {
    it('returns uppercase type if provided on notification', () => {
      expect(inferNotificationType(buildNotification({ type: 'task' }))).toBe('TASK');
    });

    it('infers type from link or message', () => {
      expect(inferNotificationType(buildNotification({ message: 'User mentioned you' }))).toBe('MENTION');
      expect(inferNotificationType(buildNotification({ link: '/project/1/chat' }))).toBe('CHAT');
      expect(inferNotificationType(buildNotification({ link: '/taskcard?taskId=5' }))).toBe('TASK');
      expect(inferNotificationType(buildNotification({ link: '/pages/2' }))).toBe('PAGE');
      expect(inferNotificationType(buildNotification({ link: '/project/3' }))).toBe('PROJECT');
      expect(inferNotificationType(buildNotification({ message: 'Something else' }))).toBe('GENERAL');
    });
  });

  describe('toTypeLabel', () => {
    it('formats type into title case label', () => {
      expect(toTypeLabel('CHAT_ACTIVITY')).toBe('Chat Activity');
      expect(toTypeLabel('TASK')).toBe('Task');
    });
  });

  describe('formatRelativeTime', () => {
    it('formats valid ISO date string or falls back cleanly', () => {
      const formatted = formatRelativeTime('2026-04-10T10:00:00.000Z');
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('extractTaskIdFromLink', () => {
    it('extracts taskId from query param', () => {
      expect(extractTaskIdFromLink('/taskcard?taskId=42')).toBe(42);
      expect(extractTaskIdFromLink('https://example.com/tasks?taskId=99')).toBe(99);
    });

    it('extracts taskId from url path', () => {
      expect(extractTaskIdFromLink('/project/1/tasks/105')).toBe(105);
    });

    it('returns null for links without taskId', () => {
      expect(extractTaskIdFromLink('/project/1/chat')).toBeNull();
      expect(extractTaskIdFromLink('')).toBeNull();
      expect(extractTaskIdFromLink(undefined)).toBeNull();
    });
  });

  describe('hasActionLink', () => {
    it('returns true only when non-empty link exists', () => {
      expect(hasActionLink(buildNotification({ link: '/project/1' }))).toBe(true);
      expect(hasActionLink(buildNotification({ link: '' }))).toBe(false);
      expect(hasActionLink(buildNotification({ link: '   ' }))).toBe(false);
    });
  });

  describe('getPageNumbers', () => {
    it('returns empty array when totalPages <= 0', () => {
      expect(getPageNumbers(1, 0)).toEqual([]);
      expect(getPageNumbers(1, -5)).toEqual([]);
    });

    it('returns all pages when totalPages <= maxVisible', () => {
      expect(getPageNumbers(1, 5, 7)).toEqual([1, 2, 3, 4, 5]);
      expect(getPageNumbers(3, 7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('returns start block with ellipsis when near start', () => {
      expect(getPageNumbers(1, 10, 7)).toEqual([1, 2, 3, 4, 5, '...', 10]);
    });

    it('returns end block with ellipsis when near end', () => {
      expect(getPageNumbers(8, 10, 7)).toEqual([1, '...', 6, 7, 8, 9, 10]);
    });

    it('returns middle block with ellipses on both sides', () => {
      expect(getPageNumbers(5, 10, 7)).toEqual([1, '...', 4, 5, 6, '...', 10]);
    });
  });

  describe('paginateNotifications', () => {
    const list: Notification[] = [
      buildNotification({ id: 1 }),
      buildNotification({ id: 2 }),
      buildNotification({ id: 3 }),
      buildNotification({ id: 4 }),
      buildNotification({ id: 5 }),
    ];

    it('returns original list if pageSize <= 0', () => {
      expect(paginateNotifications(list, 1, 0)).toEqual(list);
    });

    it('paginates correctly across pages', () => {
      expect(paginateNotifications(list, 1, 2).map((n) => n.id)).toEqual([1, 2]);
      expect(paginateNotifications(list, 2, 2).map((n) => n.id)).toEqual([3, 4]);
      expect(paginateNotifications(list, 3, 2).map((n) => n.id)).toEqual([5]);
    });

    it('returns empty array if page is out of bounds', () => {
      expect(paginateNotifications(list, 5, 2)).toEqual([]);
    });
  });
});
