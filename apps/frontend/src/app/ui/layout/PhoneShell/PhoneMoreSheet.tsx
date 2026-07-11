'use client';

import React from 'react';
import type { IconType } from 'react-icons';

import BottomSheet from './BottomSheet';

export type PhoneMoreSection = {
  key: string;
  label: string;
  context: string;
  href: string;
  icon: IconType;
  disabled: boolean;
};

export type PhoneMoreLink = {
  key: string;
  label: string;
  href: string;
  icon: IconType;
};

export type PhoneMoreSheetProps = {
  open: boolean;
  onClose: () => void;
  sections: PhoneMoreSection[];
  links: PhoneMoreLink[];
  onNavigate: (href: string) => void;
};

/**
 * The More bottom sheet: the six secondary areas (each with a context line),
 * then the always-available Settings and Developer portal links, then the system
 * status line. Built on the shared BottomSheet primitive.
 */
const PhoneMoreSheet = ({ open, onClose, sections, links, onNavigate }: PhoneMoreSheetProps) => {
  const go = (href: string) => {
    onNavigate(href);
    onClose();
  };

  return (
    <BottomSheet open={open} title="More" onClose={onClose} className="yc-phone-more-sheet">
      <ul className="yc-phone-more-list">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <li key={section.key}>
              <button
                type="button"
                className={`yc-phone-more-row ${section.disabled ? 'yc-phone-more-row-disabled' : ''}`.trim()}
                onClick={() => go(section.href)}
                disabled={section.disabled}
              >
                <span className="yc-phone-more-icon" aria-hidden>
                  <Icon size={20} />
                </span>
                <span className="yc-phone-more-copy">
                  <span className="yc-phone-more-label">{section.label}</span>
                  <span className="yc-phone-more-context">{section.context}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <hr className="yc-phone-more-divider" />

      <ul className="yc-phone-more-list">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <li key={link.key}>
              <button
                type="button"
                className="yc-phone-more-row yc-phone-more-row-compact"
                onClick={() => go(link.href)}
              >
                <span className="yc-phone-more-icon" aria-hidden>
                  <Icon size={20} />
                </span>
                <span className="yc-phone-more-label">{link.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="yc-phone-more-status">
        <span className="yc-phone-more-status-dot" aria-hidden />
        {'All systems live'}
      </div>
    </BottomSheet>
  );
};

export default PhoneMoreSheet;
