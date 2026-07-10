import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotificationsPanel from '@/app/ui/layout/Notifications/NotificationsPanel';
import type { NotificationItem } from '@/app/ui/layout/Notifications/notificationTypes';

const items: NotificationItem[] = [
  {
    id: 'u-blue',
    tone: 'blue',
    icon: 'lab',
    title: 'Lab results ready',
    detail: ' · Chem 17 for Poppy',
    meta: '2 min ago · IDEXX',
    read: false,
    dotTone: 'blue',
  },
  {
    id: 'u-pink',
    tone: 'pink',
    icon: 'chat',
    title: 'Lena Hartmann',
    detail: ' replied',
    meta: '9 min ago · Chat',
    read: false,
    dotTone: 'pink',
  },
  {
    id: 'u-danger',
    tone: 'danger',
    icon: 'inventory',
    title: 'Low stock',
    detail: ' · Carprofen',
    meta: '31 min ago · Inventory',
    read: false,
    dotTone: 'danger',
  },
  {
    // Unread with no explicit dotTone → dot falls back to `tone`.
    id: 'u-default-dot',
    tone: 'blue',
    icon: 'appointment',
    title: 'New booking',
    detail: ' · Bruno',
    meta: '40 min ago · Appointments',
    read: false,
  },
  {
    id: 'earlier-1',
    tone: 'blue',
    icon: 'payout',
    title: 'Payout sent',
    detail: ' · €4,820.00',
    meta: 'Yesterday · Stripe',
    read: true,
  },
];

describe('NotificationsPanel', () => {
  it('renders the empty "All caught up" state when there are no items', () => {
    render(
      <NotificationsPanel
        layout="dropdown"
        items={[]}
        unreadCount={0}
        onMarkAllRead={jest.fn()}
      />
    );

    expect(screen.getByText('All caught up')).toBeInTheDocument();
    expect(
      screen.getByText('New bookings, lab results and messages will land here.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Unread')).not.toBeInTheDocument();
  });

  it('renders unread + earlier groups, the count badge, and every row type', () => {
    render(
      <NotificationsPanel
        layout="dropdown"
        items={items}
        unreadCount={4}
        onMarkAllRead={jest.fn()}
      />
    );

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByLabelText('4 unread')).toHaveTextContent('4');
    expect(screen.getByText('Unread')).toBeInTheDocument();
    expect(screen.getByText('Earlier')).toBeInTheDocument();
    expect(screen.getByText('Lab results ready')).toBeInTheDocument();
    expect(screen.getByText('Payout sent')).toBeInTheDocument();
    // Four unread rows carry a dot; the earlier row does not.
    expect(screen.getAllByLabelText('Unread')).toHaveLength(4);
    // Footer only renders in the dropdown layout.
    expect(screen.getByText('View all')).toBeInTheDocument();
    expect(screen.getByText('Notification settings')).toBeInTheDocument();
  });

  it('hides the count badge when there are items but zero unread', () => {
    render(
      <NotificationsPanel
        layout="dropdown"
        items={[items[4]]}
        unreadCount={0}
        onMarkAllRead={jest.fn()}
      />
    );

    expect(screen.queryByLabelText(/^\d+ unread$/)).not.toBeInTheDocument();
    expect(screen.getByText('Mark all read')).toBeInTheDocument();
    expect(screen.getByText('Earlier')).toBeInTheDocument();
    expect(screen.queryByText('Unread')).not.toBeInTheDocument();
  });

  it('fires the header, footer and row callbacks', () => {
    const onMarkAllRead = jest.fn();
    const onViewAll = jest.fn();
    const onSettings = jest.fn();
    const onItemClick = jest.fn();

    render(
      <NotificationsPanel
        layout="dropdown"
        items={items}
        unreadCount={4}
        onMarkAllRead={onMarkAllRead}
        onViewAll={onViewAll}
        onSettings={onSettings}
        onItemClick={onItemClick}
      />
    );

    fireEvent.click(screen.getByText('Mark all read'));
    fireEvent.click(screen.getByText('View all'));
    fireEvent.click(screen.getByText('Notification settings'));
    fireEvent.click(screen.getByText('Lab results ready'));

    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
    expect(onViewAll).toHaveBeenCalledTimes(1);
    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(onItemClick).toHaveBeenCalledWith(items[0]);
  });

  it('omits the footer in the sheet layout, renders unread-only, and tolerates a missing handler', () => {
    // Unread-only items: exercises the "no Earlier group" branch.
    render(
      <NotificationsPanel
        layout="sheet"
        items={items.slice(0, 4)}
        unreadCount={4}
        onMarkAllRead={jest.fn()}
      />
    );

    expect(screen.queryByText('View all')).not.toBeInTheDocument();
    expect(screen.getByText('Unread')).toBeInTheDocument();
    expect(screen.queryByText('Earlier')).not.toBeInTheDocument();
    // No onItemClick passed — clicking must not throw.
    fireEvent.click(screen.getByText('Lab results ready'));
    expect(screen.getByText('Lab results ready')).toBeInTheDocument();
  });
});
