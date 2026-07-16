import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotificationsBell from '@/app/ui/layout/Notifications/NotificationsBell';
import { SAMPLE_NOTIFICATIONS } from '@/app/ui/layout/Notifications/notificationSamples';
import { startRouteLoader } from '@/app/lib/routeLoader';

const pushMock = jest.fn();
let mockSnapshot: {
  items: typeof SAMPLE_NOTIFICATIONS;
  unreadCount: number;
  hasFeed: boolean;
  markAllRead: jest.Mock;
};

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: jest.fn() }),
}));

jest.mock('@/app/lib/routeLoader', () => ({
  startRouteLoader: jest.fn(),
}));

jest.mock('@/app/ui/layout/Notifications/useNotifications', () => ({
  useNotifications: () => mockSnapshot,
}));

describe('NotificationsBell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSnapshot = {
      items: SAMPLE_NOTIFICATIONS,
      unreadCount: 3,
      hasFeed: true,
      markAllRead: jest.fn(),
    };
  });

  it('shows the unread dot only when there is an unread count', () => {
    const { container, rerender } = render(<NotificationsBell />);
    expect(container.querySelector('.yc-notification-dot')).toBeInTheDocument();

    mockSnapshot = { items: [], unreadCount: 0, hasFeed: false, markAllRead: jest.fn() };
    rerender(<NotificationsBell />);
    expect(container.querySelector('.yc-notification-dot')).not.toBeInTheDocument();
  });

  it('toggles the dropdown open and closed from the bell', () => {
    render(<NotificationsBell />);
    const trigger = screen.getByRole('button', { name: 'Notifications' });

    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the dropdown on Escape and on outside click', () => {
    render(<NotificationsBell />);
    const trigger = screen.getByRole('button', { name: 'Notifications' });

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    // A mousedown inside the panel must NOT close it.
    fireEvent.mouseDown(dialog);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // A mousedown outside closes it.
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('marks all read, navigates to settings, and closes on row clicks', () => {
    render(<NotificationsBell />);
    const trigger = screen.getByRole('button', { name: 'Notifications' });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByText('Mark all read'));
    expect(mockSnapshot.markAllRead).toHaveBeenCalledTimes(1);
    // Mark-all-read keeps the panel open.
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Notification settings'));
    expect(startRouteLoader).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/settings');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByText('Lab results ready'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not render "View all" while there is no notifications route to open', () => {
    render(<NotificationsBell />);

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    // The bell withholds onViewAll: a "View all" button here could only close
    // the panel, which is a dead control. The real footer action still works.
    expect(screen.queryByText('View all')).not.toBeInTheDocument();
    expect(screen.getByText('Notification settings')).toBeInTheDocument();
  });

  it('renders the phone bottom-sheet variant and closes via its backdrop', () => {
    const { container } = render(<NotificationsBell variant="phone" />);
    expect(container.querySelector('.yc-phone-bell-dot')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeInTheDocument();
    expect(document.querySelector('.yc-noti-home-indicator')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close notifications' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
