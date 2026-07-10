'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { IoNotifications } from 'react-icons/io5';
import { startRouteLoader } from '@/app/lib/routeLoader';
import { useNotifications } from './useNotifications';
import NotificationsPanel from './NotificationsPanel';
import type { NotificationItem } from './notificationTypes';
import './Notifications.css';

export type NotificationsBellProps = {
  /** `desktop` = header pill + dropdown; `phone` = phone header icon + bottom-sheet. */
  variant?: 'desktop' | 'phone';
};

const NotificationsBell = ({ variant = 'desktop' }: NotificationsBellProps) => {
  const router = useRouter();
  const { items, unreadCount, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const isPhone = variant === 'phone';

  const close = useCallback(() => setOpen(false), []);

  // Escape closes either surface.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, close]);

  // Desktop dropdown closes on outside click (the phone sheet uses its backdrop).
  useEffect(() => {
    if (!open || isPhone) return undefined;
    const onMouseDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open, isPhone, close]);

  const goToSettings = () => {
    close();
    startRouteLoader();
    router.push('/settings');
  };

  const handleItemClick = (_item: NotificationItem) => {
    close();
  };

  const triggerClass = isPhone ? 'yc-phone-iconbtn yc-phone-bell' : 'yc-icon-button';
  const dotClass = isPhone ? 'yc-phone-bell-dot' : 'yc-notification-dot';

  const trigger = (
    <button
      type="button"
      className={triggerClass}
      aria-label="Notifications"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      onClick={() => setOpen((prev) => !prev)}
    >
      <IoNotifications size={isPhone ? 18 : 19} />
      {unreadCount > 0 ? <span className={dotClass} aria-hidden /> : null}
    </button>
  );

  const panel = (
    <NotificationsPanel
      layout={isPhone ? 'sheet' : 'dropdown'}
      items={items}
      unreadCount={unreadCount}
      onMarkAllRead={markAllRead}
      onItemClick={handleItemClick}
      onViewAll={close}
      onSettings={goToSettings}
    />
  );

  if (isPhone) {
    return (
      <div className="yc-noti-wrap" ref={wrapRef}>
        {trigger}
        {open
          ? createPortal(
              <div className="yc-noti-sheet-root" role="presentation">
                <button
                  type="button"
                  className="yc-noti-sheet-backdrop"
                  aria-label="Close notifications"
                  onClick={close}
                />
                <div
                  id={panelId}
                  className="yc-noti-sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Notifications"
                >
                  <span className="yc-noti-sheet-grabber" aria-hidden />
                  {panel}
                  <span className="yc-noti-home-indicator" aria-hidden />
                </div>
              </div>,
              document.body
            )
          : null}
      </div>
    );
  }

  return (
    <div className="yc-noti-wrap" ref={wrapRef}>
      {trigger}
      {open ? (
        <div id={panelId} className="yc-noti-panel" role="dialog" aria-label="Notifications">
          {panel}
        </div>
      ) : null}
    </div>
  );
};

export default NotificationsBell;
