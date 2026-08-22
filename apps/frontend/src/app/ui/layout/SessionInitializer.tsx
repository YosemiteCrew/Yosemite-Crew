'use client';
import React, { useEffect, useRef } from 'react';

import Header from '@/app/ui/layout/Header/Header';
import { useFullscreenLoader } from '@/app/hooks/useFullscreenLoader';
import { useAuthStore } from '@/app/stores/authStore';
import Sidebar from '@/app/ui/layout/Sidebar/Sidebar';
import PhoneShell from '@/app/ui/layout/PhoneShell/PhoneShell';
import UniversalSearchPalette from '@/app/ui/layout/UniversalSearch/UniversalSearchPalette';
import { useOrgStore } from '@/app/stores/orgStore';
import { useLoadOrg } from '@/app/hooks/useLoadOrg';
import { useLoadProfiles, usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import { useLoadAvailabilities } from '@/app/hooks/useAvailabiities';
import { loadAvailability } from '@/app/features/organization/services/availabilityService';
import { loadAppointmentsForPrimaryOrg } from '@/app/features/appointments/services/appointmentService';
import { loadCompanionsForPrimaryOrg } from '@/app/features/companions/services/companionService';
import { loadInvoicesForOrgPrimaryOrg } from '@/app/features/billing/services/invoiceService';
import { loadTasksForPrimaryOrg } from '@/app/features/tasks/services/taskService';
import { loadTeam } from '@/app/features/organization/services/teamService';
import { loadRoomsForOrgPrimaryOrg } from '@/app/features/organization/services/roomService';
import { isLocalGuardBypassEnabled } from '@/app/lib/localGuardBypass';
import { loadDocumentsForOrgPrimaryOrg } from '@/app/features/documents/services/documentService';
import { loadForms } from '@/app/features/forms/services/formService';
import { loadIntegrationsForPrimaryOrg } from '@/app/hooks/useIntegrations';
import { loadOrgs } from '@/app/features/organization/services/orgService';
import { loadProfiles } from '@/app/features/organization/services/profileService';
import { loadSpecialitiesForOrg } from '@/app/features/organization/services/specialityService';
import {
  getCompanionTerminologyForOrg,
  rewriteCompanionTerminologyText,
  setCompanionTerminologyForOrg,
} from '@/app/lib/companionTerminology';
import { isValidAnimalTerminology } from '@/app/features/settings/utils/pmsPreferences';

const TERMINOLOGY_ATTRIBUTES = ['placeholder', 'title', 'aria-label'] as const;

const createTerminologyRewriter = (primaryOrgId?: string | null) => {
  const getActiveTerminology = () => {
    const orgState = useOrgStore.getState();
    const activeOrgId = orgState.primaryOrgId || primaryOrgId;
    const activeOrgType = activeOrgId ? orgState.orgsById[activeOrgId]?.type : undefined;
    return getCompanionTerminologyForOrg(activeOrgId, activeOrgType);
  };

  const isInsideTerminologyLock = (node: Node | null) => {
    if (!node) return false;
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    return Boolean(element?.closest("[data-terminology-lock='true']"));
  };

  const rewriteTextNode = (node: Text) => {
    if (isInsideTerminologyLock(node)) return;
    const next = rewriteCompanionTerminologyText(node.nodeValue ?? '', getActiveTerminology());
    if (next !== node.nodeValue) {
      node.nodeValue = next;
    }
  };

  const rewriteElementAttributes = (element: Element) => {
    if (isInsideTerminologyLock(element)) return;
    TERMINOLOGY_ATTRIBUTES.forEach((attr) => {
      const current = element.getAttribute(attr);
      if (!current) return;
      const next = rewriteCompanionTerminologyText(current, getActiveTerminology());
      if (next !== current) {
        element.setAttribute(attr, next);
      }
    });
  };

  /**
   * The browser tab.
   *
   * The rewriter below is rooted at `document.body`, so it never reached the
   * `<title>` in `<head>` - an org set to "Patients" still had a tab reading
   * "Companions", contradicting every heading on the page. Route metadata is
   * static (`export const metadata`) and rendered on the server, which has no
   * access to the org's choice, so the term is applied here instead.
   */
  const rewriteDocumentTitle = () => {
    const next = rewriteCompanionTerminologyText(document.title, getActiveTerminology());
    if (next !== document.title) {
      document.title = next;
    }
  };

  const rewriteNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      rewriteTextNode(node as Text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as Element;
    if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') return;
    if (isInsideTerminologyLock(element)) return;
    rewriteElementAttributes(element);

    // DESCENDANT elements too, not just this one. Previously only the added
    // element's own attributes were rewritten while the walker covered text
    // nodes at any depth, so a nested `aria-label` never got the org's term -
    // "Upload companion photo" stayed raw inside the Add patient modal in an
    // org set to Patients. Text and attributes are walked in one pass.
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
    );
    let current = walker.nextNode();
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) {
        rewriteTextNode(current as Text);
      } else {
        rewriteElementAttributes(current as Element);
      }
      current = walker.nextNode();
    }
  };

  const handleMutations = (mutations: MutationRecord[]) => {
    // Next swaps <title> on navigation, and a navigation always mutates the body
    // too - so the tab is re-applied from here rather than from a second
    // MutationObserver on <title>, which was an extra live handle for nothing.
    rewriteDocumentTitle();
    mutations.forEach((mutation) => {
      if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
        rewriteTextNode(mutation.target as Text);
        return;
      }
      mutation.addedNodes.forEach((added) => rewriteNode(added));
    });
  };

  return { rewriteNode, handleMutations, rewriteDocumentTitle };
};

const SessionInitializer = ({ children }: { children: React.ReactNode }) => {
  useLoadOrg();
  useLoadProfiles();
  useLoadAvailabilities();

  const status = useAuthStore((s) => s.status);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const primaryOrgProfile = usePrimaryOrgProfile();
  const refreshedOrgIdRef = useRef<string | null>(null);

  useEffect(() => {
    useAuthStore
      .getState()
      .checkSession()
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!primaryOrgId) return;
    if (refreshedOrgIdRef.current === primaryOrgId) return;
    refreshedOrgIdRef.current = primaryOrgId;

    Promise.allSettled([
      loadOrgs({ silent: true }),
      loadProfiles({ silent: true }),
      loadAvailability({ silent: true }),
      loadTeam({ silent: true }),
      loadSpecialitiesForOrg({ silent: true, orgId: primaryOrgId }),
      loadRoomsForOrgPrimaryOrg({ silent: true }),
      loadAppointmentsForPrimaryOrg({ silent: true }),
      loadCompanionsForPrimaryOrg({ silent: true }),
      loadInvoicesForOrgPrimaryOrg({ silent: true }),
      loadTasksForPrimaryOrg({ silent: true }),
      loadDocumentsForOrgPrimaryOrg({ silent: true }),
      loadForms(true),
      loadIntegrationsForPrimaryOrg({ silent: true }),
    ]).catch((error) => {
      console.error('Failed to refresh organization-scoped stores:', error);
    });
  }, [primaryOrgId]);

  useEffect(() => {
    if (!primaryOrgId) return;
    const profileTerminology =
      primaryOrgProfile?.personalDetails?.pmsPreferences?.animalTerminology;
    if (!isValidAnimalTerminology(profileTerminology)) return;
    setCompanionTerminologyForOrg(primaryOrgId, profileTerminology);
  }, [primaryOrgId, primaryOrgProfile?.personalDetails?.pmsPreferences?.animalTerminology]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.body;
    if (!root) return;
    const { rewriteNode, handleMutations, rewriteDocumentTitle } =
      createTerminologyRewriter(primaryOrgId);

    rewriteNode(root);
    rewriteDocumentTitle();

    const observer = new MutationObserver(handleMutations);

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TERMINOLOGY_ATTRIBUTES],
    });

    const handleTerminologyChange = () => {
      rewriteNode(root);
      rewriteDocumentTitle();
    };
    globalThis.window.addEventListener('yc:companion-terminology-changed', handleTerminologyChange);

    return () => {
      observer.disconnect();
      globalThis.window.removeEventListener(
        'yc:companion-terminology-changed',
        handleTerminologyChange
      );
    };
  }, [primaryOrgId]);

  // On localhost with NEXT_PUBLIC_DISABLE_AUTH_GUARD, render the app shell without a
  // real session so UI/styling work needs no login (matches the guards, which also
  // short-circuit on this flag). The shared helper is what makes the "localhost"
  // part true: reading the env var directly let a build that set the flag by
  // accident render the private shell on a deployed host.
  const authGuardDisabled = isLocalGuardBypassEnabled();
  const isChecking = !authGuardDisabled && (status === 'idle' || status === 'checking');
  useFullscreenLoader('session-initializer', isChecking);

  return (
    <div data-yc-app className="flex h-screen flex-1 lg:overflow-hidden">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <Header user />
        <UniversalSearchPalette />

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 lg:overflow-y-scroll lg:[scrollbar-gutter:stable] min-w-0"
        >
          {isChecking ? null : children}
        </main>
      </div>

      <PhoneShell />
    </div>
  );
};

export default SessionInitializer;
