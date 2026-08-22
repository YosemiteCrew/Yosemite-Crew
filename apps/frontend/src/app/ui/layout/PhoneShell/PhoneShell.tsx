'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

import PhoneHeader from './PhoneHeader';
import PhoneTabBar, { type PhoneTabItem } from './PhoneTabBar';
import PhoneFab from './PhoneFab';
import PhoneMoreSheet, { type PhoneMoreSection } from './PhoneMoreSheet';
import { useIsPhone } from './useIsPhone';
import { usePhoneNavGate } from './usePhoneNavGate';
import { usePhoneShellStore } from './phoneShellStore';
import { useSignOut } from '@/app/hooks/useAuth';
import { usePermissions } from '@/app/hooks/usePermissions';
import { startRouteLoader, stopRouteLoader } from '@/app/lib/routeLoader';
import {
  PHONE_MORE_LINKS,
  PHONE_MORE_SECTIONS,
  PHONE_PRIMARY_ACTION_EVENT,
  PHONE_TABS,
  resolveFabAction,
  type FabAction,
  type PhonePrimaryActionDetail,
} from './phoneShellConfig';

import './PhoneShell.css';

export { PHONE_PRIMARY_ACTION_EVENT };

const handleFabAction = (action: FabAction) => {
  globalThis.window.dispatchEvent(
    new CustomEvent<PhonePrimaryActionDetail>(PHONE_PRIMARY_ACTION_EVENT, {
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
  const router = useRouter();
  const { signOut } = useSignOut();
  const { canAny } = usePermissions();
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname, isRouteEnabled, isActive, navigate } = usePhoneNavGate();
  const chatUnread = usePhoneShellStore((s) => s.chatUnread);

  // Mirrors the desktop avatar-menu logout: sign out, then land on the sign-in
  // route for the surface the user was in.
  const handleSignOut = async () => {
    startRouteLoader();
    try {
      await signOut();
      router.replace(pathname.startsWith('/developers') ? '/developers/signin' : '/signin');
    } catch (error) {
      console.error('⚠️ Signout error:', error);
      stopRouteLoader();
    }
  };

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
    activeIcon: tab.activeIcon,
    href: tab.href,
    active: tab.isMore ? isActive(tab.activePrefixes) && !moreOpen : isActive(tab.activePrefixes),
    disabled: !isRouteEnabled(tab.routeName),
    isMore: tab.isMore,
    badgeCount: tab.hasBadge ? chatUnread : 0,
  }));

  const candidateFab = resolveFabAction(pathname);
  // The route being enabled only means the user can VIEW the list. Creating
  // needs the same edit grant the desktop create button checks, otherwise a
  // view-only user gets a create flow on a phone that is hidden on desktop.
  const fabAction =
    candidateFab && isRouteEnabled(candidateFab.routeName) && canAny(candidateFab.createAnyOf)
      ? candidateFab
      : null;

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
        onSignOut={handleSignOut}
      />
    </>
  );
};

export default PhoneShell;
