'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { startRouteLoader, stopRouteLoader } from '@/app/lib/routeLoader';
import { useRouteLoaderStore } from '@/app/stores/routeLoaderStore';

const ROUTE_LOADER_ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

const RouteLoaderOverlay = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const isLoading = useRouteLoaderStore((s) => s.isLoading);
  const initializedRef = useRef(false);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.dataset.noRouteLoader === 'true') return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const rawHref = anchor.getAttribute('href') ?? '';
      if (rawHref.startsWith('#')) return;

      let nextUrl: URL;
      try {
        nextUrl = new URL(anchor.href, globalThis.window.location.href);
      } catch {
        return;
      }

      if (!ROUTE_LOADER_ALLOWED_PROTOCOLS.has(nextUrl.protocol)) return;
      if (nextUrl.origin !== globalThis.window.location.origin) return;

      const current = `${globalThis.window.location.pathname}${globalThis.window.location.search}${globalThis.window.location.hash}`;
      const next = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      if (current === next) return;

      startRouteLoader();
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, []);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    stopRouteLoader();
  }, [pathname, searchKey]);

  useEffect(() => {
    if (!isLoading) return;
    const timeout = globalThis.window.setTimeout(() => {
      stopRouteLoader();
    }, 15000);

    return () => {
      globalThis.window.clearTimeout(timeout);
    };
  }, [isLoading]);

  if (!isLoading) return null;

  return null;
};

export default RouteLoaderOverlay;
