'use client';

import React from 'react';
import type { IconType } from 'react-icons';
import { IoChevronForwardOutline } from 'react-icons/io5';

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
      <ul className="yc-phone-more-grid">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <li key={section.key}>
              <button
                type="button"
                className={`yc-phone-more-tile ${section.disabled ? 'yc-phone-more-tile-disabled' : ''}`.trim()}
                onClick={() => go(section.href)}
                disabled={section.disabled}
              >
                <span className="yc-phone-more-tile-icon" aria-hidden>
                  <Icon size={16} />
                </span>
                <span className="yc-phone-more-tile-copy">
                  <span className="yc-phone-more-tile-label">{section.label}</span>
                  <span className="yc-phone-more-tile-context">{section.context}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <ul className="yc-phone-more-list">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <li key={link.key}>
              <button type="button" className="yc-phone-more-row" onClick={() => go(link.href)}>
                <span
                  className={`yc-phone-more-row-icon yc-phone-more-row-icon-${link.key}`}
                  aria-hidden
                >
                  <Icon size={17} />
                </span>
                <span className="yc-phone-more-row-label">{link.label}</span>
                <IoChevronForwardOutline
                  className="yc-phone-more-row-chevron"
                  size={14}
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
        <li>
          <div className="yc-phone-more-row yc-phone-more-status-row">
            <span className="yc-phone-more-status-dot" aria-hidden />
            <span className="yc-phone-more-row-label">All systems live</span>
            <span className="yc-phone-more-status-url">status.yosemitecrew.com</span>
          </div>
        </li>
      </ul>
    </BottomSheet>
  );
};

export default PhoneMoreSheet;
