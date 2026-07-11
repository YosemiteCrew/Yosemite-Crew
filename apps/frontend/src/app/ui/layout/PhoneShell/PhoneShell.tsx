'use client';

import React, { useState } from 'react';

import PhoneHeader from './PhoneHeader';
import PhoneTabBar, { type PhoneTabItem } from './PhoneTabBar';
import PhoneFab from './PhoneFab';
import PhoneMoreSheet, { type PhoneMoreSection } from './PhoneMoreSheet';
import { useIsPhone } from './useIsPhone';
import { usePhoneNavGate } from './usePhoneNavGate';
import { usePhoneShellStore } from './phoneShellStore';
import {
  PHONE_MORE_LINKS,
  PHONE_MORE_SECTIONS,
  PHONE_TABS,
  resolveFabAction,
  type FabAction,
} from './phoneShellConfig';

import './PhoneShell.css';

/** Custom event the FAB dispatches so the active page can open its create flow. */
export const PHONE_PRIMARY_ACTION_EVENT = 'yc:phone-primary-action';

const handleFabAction = (action: FabAction) => {
  globalThis.window.dispatchEvent(
    new CustomEvent(PHONE_PRIMARY_ACTION_EVENT, {
      detail: { key: action.key, href: action.matchHref },
    })
  );
};

/**
 * The phone (< 768px) app shell: 54px header, bottom tab bar, floating action
 * button and the More bottom sheet. Renders nothing on tablet/desktop (guarded
 * by `useIsPhone`) so the existing sidebar + header experience is untouched.
 */
const PhoneShell = () => {
  const isPhone = useIsPhone();
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname, isRouteEnabled, isActive, navigate } = usePhoneNavGate();
  const chatUnread = usePhoneShellStore((s) => s.chatUnread);

  // Close the More sheet whenever the route changes, adjusting state during render
  // (tracking the previous pathname) instead of via an effect.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMoreOpen(false);
  }

  if (!isPhone) return null;

  const tabItems: PhoneTabItem[] = PHONE_TABS.map((tab) => ({
    key: tab.key,
    label: tab.label,
    icon: tab.icon,
    href: tab.href,
    active: tab.isMore ? isActive(tab.activePrefixes) && !moreOpen : isActive(tab.activePrefixes),
    disabled: !isRouteEnabled(tab.routeName),
    isMore: tab.isMore,
    badgeCount: tab.hasBadge ? chatUnread : 0,
  }));

  const candidateFab = resolveFabAction(pathname);
  const fabAction = candidateFab && isRouteEnabled(candidateFab.routeName) ? candidateFab : null;

  const moreSections: PhoneMoreSection[] = PHONE_MORE_SECTIONS.map((section) => ({
    key: section.key,
    label: section.label,
    context: section.context,
    href: section.href,
    icon: section.icon,
    disabled: !isRouteEnabled(section.routeName),
  }));

  return (
    <>
      <PhoneHeader />
      <PhoneTabBar
        items={tabItems}
        moreOpen={moreOpen}
        onNavigate={navigate}
        onOpenMore={() => setMoreOpen(true)}
      />
      <PhoneFab action={fabAction} onAction={handleFabAction} />
      <PhoneMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        sections={moreSections}
        links={PHONE_MORE_LINKS}
        onNavigate={navigate}
      />
    </>
  );
};

export default PhoneShell;
