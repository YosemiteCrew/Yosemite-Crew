import type { ReactNode } from 'react';
import { SiteNav, type NavKey } from './SiteNav';
import { SiteFooter } from './SiteFooter';
import { ScrollProgress, ScrollDrift } from './motion';

interface MarketingShellProps {
  children: ReactNode;
  active?: NavKey;
  /** Skip the shared footer for pages that render their own. */
  hideFooter?: boolean;
}

/**
 * Standard chrome for a public marketing page: fixed nav, the main landmark
 * (skip-link target), the shared footer, and the scroll-progress bar.
 */
export function MarketingShell({
  children,
  active,
  hideFooter = false,
}: Readonly<MarketingShellProps>) {
  return (
    <div data-yc-theme style={{ background: 'var(--page)', color: 'var(--ink-body)' }}>
      <ScrollProgress />
      <ScrollDrift />
      <SiteNav active={active} />
      <main
        id="main-content"
        tabIndex={-1}
        className="yc-public-page"
        style={{ background: 'var(--page)' }}
      >
        {children}
      </main>
      {hideFooter ? null : <SiteFooter />}
    </div>
  );
}
