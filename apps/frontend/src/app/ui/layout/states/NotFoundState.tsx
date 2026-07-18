'use client';

import React from 'react';
import { IoSearchOutline } from 'react-icons/io5';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { useUniversalSearchStore } from '@/app/stores/universalSearchStore';
import './states.css';

export type NotFoundStateProps = {
  /** Primary action target — a real route. */
  homeHref?: string;
  homeLabel?: string;
  /** Search action; defaults to opening the ⌘K universal search palette. */
  onSearch?: () => void;
};

const NotFoundState = ({
  homeHref = '/dashboard',
  homeLabel = 'Go to Dashboard',
  onSearch,
}: NotFoundStateProps) => {
  const openSearch = onSearch ?? (() => useUniversalSearchStore.getState().open());

  return (
    <div className="yc-state-wrap">
      <div className="yc-state-card">
        <div className="yc-state-404 font-newsreader">404</div>
        <div className="yc-state-title">This page wandered off</div>
        <p className="yc-state-text">
          The link may be old, or the record was moved to another organization.
        </p>
        <div className="yc-state-actions">
          <Primary href={homeHref} text={homeLabel} />
          <Secondary text="Search ⌘K" icon={<IoSearchOutline aria-hidden />} onClick={openSearch} />
        </div>
      </div>
    </div>
  );
};

export default NotFoundState;
