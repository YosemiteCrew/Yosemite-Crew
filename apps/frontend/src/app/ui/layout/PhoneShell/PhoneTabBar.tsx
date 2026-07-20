'use client';

import React from 'react';
import type { IconType } from 'react-icons';

export type PhoneTabItem = {
  key: string;
  label: string;
  icon: IconType;
  /** Filled icon used while the tab is active; falls back to `icon` when absent. */
  activeIcon?: IconType;
  href?: string;
  active: boolean;
  disabled: boolean;
  isMore?: boolean;
  badgeCount?: number;
};

export type PhoneTabBarProps = {
  items: PhoneTabItem[];
  /** True while the More sheet is open (drives aria-expanded on the More tab). */
  moreOpen: boolean;
  onNavigate: (href: string) => void;
  onOpenMore: () => void;
};

const formatBadge = (count: number): string => (count > 99 ? '99+' : String(count));

/**
 * Fixed bottom tab bar for the phone shell: Home, Schedule, Patients, Chat and
 * More. Renders only inside the phone shell (which is gated to < 768px). Each
 * control is >= 44px, active tabs get `aria-current`, disabled tabs mirror the
 * sidebar's permission/verification gate, and the Chat tab surfaces an unread
 * badge.
 */
const PhoneTabBar = ({ items, moreOpen, onNavigate, onOpenMore }: PhoneTabBarProps) => (
  <nav className="yc-phone-tabbar" aria-label="Primary">
    <ul className="yc-phone-tabbar-list">
      {items.map((item) => {
        const Icon = item.active && item.activeIcon ? item.activeIcon : item.icon;
        const showBadge = !item.isMore && (item.badgeCount ?? 0) > 0;
        const badgeCount = item.badgeCount ?? 0;

        const className = [
          'yc-phone-tab',
          item.active ? 'yc-phone-tab-active' : '',
          item.disabled ? 'yc-phone-tab-disabled' : '',
        ]
          .filter(Boolean)
          .join(' ');

        const iconWrap = (
          <span className="yc-phone-tab-icon" aria-hidden>
            <Icon size={20} />
            {showBadge ? (
              <output className="yc-phone-tab-badge" aria-label={`${badgeCount} unread`}>
                {formatBadge(badgeCount)}
              </output>
            ) : null}
          </span>
        );

        // The `disabled` attribute below prevents clicks on gated tabs, so no
        // extra disabled guard is needed here.
        const handleClick = () => {
          if (item.isMore) {
            onOpenMore();
            return;
          }
          if (item.href) onNavigate(item.href);
        };

        return (
          <li className="yc-phone-tab-item" key={item.key}>
            <button
              type="button"
              className={className}
              onClick={handleClick}
              disabled={item.disabled}
              aria-current={item.active && !item.isMore ? 'page' : undefined}
              aria-haspopup={item.isMore ? 'dialog' : undefined}
              aria-expanded={item.isMore ? moreOpen : undefined}
            >
              {iconWrap}
              <span className="yc-phone-tab-label">{item.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  </nav>
);

export default PhoneTabBar;
