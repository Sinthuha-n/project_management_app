import type { Notification } from '@/services/notifications-service';

export type NotificationFilter = 'all' | 'unread' | 'read';

export type TypeTone = {
  bg: string;
  text: string;
};

export type TaskProjectLinkMap = Record<number, { projectId: number; projectName: string }>;

export type NotificationDeleteHandler = (
  event: React.MouseEvent<HTMLButtonElement>,
  notificationId: number,
) => void;

export type NotificationRow = Notification;

export const NOTIFICATIONS_PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;
export type NotificationsPageSizeOption = (typeof NOTIFICATIONS_PAGE_SIZE_OPTIONS)[number];

