import '@/app/features/marketing/site/marketing.css';

import { PRE_PAINT_SCRIPT } from '@/app/ui/theme/prePaintScript';

interface PublicLayoutProps {
  children: React.ReactNode;
}

/**
 * The public surface renders its own chrome per page: marketing pages use
 * MarketingShell (nav + main + footer), auth pages use AuthShell, and the
 * post-checkout utility pages are self-contained. So this layout is a
 * pass-through that only pulls in the shared marketing stylesheet.
 */
export default function PublicLayout({ children }: Readonly<PublicLayoutProps>) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_SCRIPT }} />
      {children}
    </>
  );
}
