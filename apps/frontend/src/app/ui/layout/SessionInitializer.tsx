'use client';
import React, { useEffect } from 'react';

import Header from '@/app/ui/layout/Header/Header';
import { useAuthStore } from '@/app/stores/authStore';
import Sidebar from '@/app/ui/layout/Sidebar/Sidebar';
import UniversalSearchPalette from '@/app/ui/layout/UniversalSearch/UniversalSearchPalette';
import { useOrgStore } from '@/app/stores/orgStore';
import {
  getCompanionTerminologyForOrg,
  rewriteCompanionTerminologyText,
} from '@/app/lib/companionTerminology';

const SessionInitializer = ({ children }: { children: React.ReactNode }) => {
  const status = useAuthStore((s) => s.status);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  useEffect(() => {
    void useAuthStore.getState().checkSession();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.body;
    if (!root) return;
    const getActiveTerminology = () => {
      const orgState = useOrgStore.getState();
      const activeOrgId = orgState.primaryOrgId || primaryOrgId;
      const activeOrgType = activeOrgId ? orgState.orgsById[activeOrgId]?.type : undefined;
      return getCompanionTerminologyForOrg(activeOrgId, activeOrgType);
    };
    const isInsideTerminologyLock = (node: Node | null) => {
      if (!node) return false;
      const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
      if (!element) return false;
      return Boolean(element.closest("[data-terminology-lock='true']"));
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
      const attrs = ['placeholder', 'title', 'aria-label'];
      attrs.forEach((attr) => {
        const current = element.getAttribute(attr);
        if (!current) return;
        const next = rewriteCompanionTerminologyText(current, getActiveTerminology());
        if (next !== current) {
          element.setAttribute(attr, next);
        }
      });
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

      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let current = walker.nextNode();
      while (current) {
        rewriteTextNode(current as Text);
        current = walker.nextNode();
      }
    };

    rewriteNode(root);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
          rewriteTextNode(mutation.target as Text);
          return;
        }
        mutation.addedNodes.forEach((added) => rewriteNode(added));
      });
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label'],
    });

    const handleTerminologyChange = () => {
      rewriteNode(root);
    };
    window.addEventListener('yc:companion-terminology-changed', handleTerminologyChange);

    return () => {
      observer.disconnect();
      window.removeEventListener('yc:companion-terminology-changed', handleTerminologyChange);
    };
  }, [primaryOrgId]);

  const isChecking = status === 'idle' || status === 'checking';

  return (
    <div className="flex h-screen flex-1 lg:overflow-hidden">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <Header user />
        <UniversalSearchPalette />

        <div className="pt-20 flex-1 lg:pt-0 lg:overflow-y-scroll lg:[scrollbar-gutter:stable] min-w-0">
          {isChecking ? null : children}
        </div>
      </div>
    </div>
  );
};

export default SessionInitializer;
