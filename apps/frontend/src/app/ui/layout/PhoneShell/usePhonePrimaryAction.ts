'use client';

import { useEffect, useRef } from 'react';

import {
  PHONE_PRIMARY_ACTION_EVENT,
  type FabActionKey,
  type PhonePrimaryActionDetail,
} from './phoneShellConfig';

/**
 * Subscribes the current page to the phone shell's floating action button.
 *
 * `PhoneShell` renders one FAB carrying the current route's single creation
 * action and dispatches `PHONE_PRIMARY_ACTION_EVENT` on tap. The shell has no
 * reference to the page's create flow, so each page opts in with one line and
 * hands back its own existing handler:
 *
 * ```ts
 * usePhonePrimaryAction('appointment', openAddAppointment);
 * ```
 *
 * The handler is held in a ref so an inline arrow re-created on every render
 * does not resubscribe, and the listener is removed on unmount.
 */
export function usePhonePrimaryAction(key: FabActionKey, handler: () => void): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const onPrimaryAction = (event: Event) => {
      const detail = (event as CustomEvent<PhonePrimaryActionDetail>).detail;
      if (detail?.key !== key) return;
      handlerRef.current();
    };

    globalThis.window.addEventListener(PHONE_PRIMARY_ACTION_EVENT, onPrimaryAction);
    return () => globalThis.window.removeEventListener(PHONE_PRIMARY_ACTION_EVENT, onPrimaryAction);
  }, [key]);
}

export default usePhonePrimaryAction;
