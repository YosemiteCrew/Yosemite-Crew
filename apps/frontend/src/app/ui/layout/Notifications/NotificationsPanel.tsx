'use client';

import React from 'react';
import {
  IoCalendarOutline,
  IoCardOutline,
  IoChatbubbleEllipsesOutline,
  IoCubeOutline,
  IoFlaskOutline,
  IoNotificationsOutline,
  IoSettingsOutline,
} from 'react-icons/io5';
import type { NotificationIconKey, NotificationItem } from './notificationTypes';

const ICONS: Record<NotificationIconKey, React.ComponentType<{ size?: number }>> = {
  lab: IoFlaskOutline,
  chat: IoChatbubbleEllipsesOutline,
  inventory: IoCubeOutline,
  appointment: IoCalendarOutline,
  payout: IoCardOutline,
};

export type NotificationsPanelProps = {
  /** `dropdown` = desktop header popover; `sheet` = phone bottom-sheet body. */
  layout: 'dropdown' | 'sheet';
  items: NotificationItem[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onItemClick?: (item: NotificationItem) => void;
  /** Omit to hide "View all" entirely — there is no destination to send the user to. */
  onViewAll?: () => void;
  onSettings?: () => void;
};

const NotificationRow = ({
  item,
  onItemClick,
}: {
  item: NotificationItem;
  onItemClick?: (item: NotificationItem) => void;
}) => {
  const Icon = ICONS[item.icon];
  const dotTone = item.dotTone ?? item.tone;
  return (
    <button
      type="button"
      className={`yc-noti-row ${item.read ? 'yc-noti-row--earlier' : 'yc-noti-row--unread'}`}
      onClick={() => onItemClick?.(item)}
    >
      <span className={`yc-noti-disc yc-noti-disc--${item.tone}`} aria-hidden>
        <Icon size={17} />
      </span>
      <span className="yc-noti-body">
        <span className="yc-noti-title">
          <strong>{item.title}</strong>
          {item.detail}
        </span>
        <span className="yc-noti-meta">{item.meta}</span>
      </span>
      {item.read ? null : (
        <span className={`yc-noti-dot yc-noti-dot--${dotTone}`} aria-label="Unread" />
      )}
    </button>
  );
};

const NotificationsPanel = ({
  layout,
  items,
  unreadCount,
  onMarkAllRead,
  onItemClick,
  onViewAll,
  onSettings,
}: NotificationsPanelProps) => {
  const unread = items.filter((item) => !item.read);
  const earlier = items.filter((item) => item.read);

  if (items.length === 0) {
    return (
      <div className={`yc-noti-content yc-noti--${layout}`}>
        <div className="yc-noti-empty">
          <span className="yc-noti-empty-disc" aria-hidden>
            <IoNotificationsOutline size={24} />
          </span>
          <div className="yc-noti-empty-title">All caught up</div>
          <p className="yc-noti-empty-text">
            New bookings, lab results and messages will land here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`yc-noti-content yc-noti--${layout}`}>
      <div className="yc-noti-head">
        <div className="yc-noti-head-title">
          <span className="yc-noti-heading">Notifications</span>
          {unreadCount > 0 ? (
            <span className="yc-noti-count" aria-label={`${unreadCount} unread`}>
              {unreadCount}
            </span>
          ) : null}
        </div>
        <button type="button" className="yc-noti-markall" onClick={onMarkAllRead}>
          Mark all read
        </button>
      </div>

      <div className="yc-noti-list">
        {unread.length > 0 ? (
          <>
            <div className="yc-noti-eyebrow">Unread</div>
            {unread.map((item) => (
              <NotificationRow key={item.id} item={item} onItemClick={onItemClick} />
            ))}
          </>
        ) : null}
        {earlier.length > 0 ? (
          <>
            <div className="yc-noti-eyebrow">Earlier</div>
            {earlier.map((item) => (
              <NotificationRow key={item.id} item={item} onItemClick={onItemClick} />
            ))}
          </>
        ) : null}
      </div>

      {layout === 'dropdown' ? (
        <div className="yc-noti-foot">
          {onViewAll ? (
            <button type="button" className="yc-noti-viewall" onClick={onViewAll}>
              View all
            </button>
          ) : null}
          <button type="button" className="yc-noti-settings" onClick={onSettings}>
            <IoSettingsOutline size={13} aria-hidden />
            Notification settings
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default NotificationsPanel;
