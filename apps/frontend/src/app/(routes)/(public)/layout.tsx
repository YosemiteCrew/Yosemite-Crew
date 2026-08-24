import '@/app/features/marketing/site/marketing.css';

import { PRE_PAINT_SCRIPT } from '@/app/ui/theme/prePaintScript';

/**
 * Scroll reveals start hidden in marketing.css and are only shown once the
 * observer in `Reveal` flips `data-reveal`. With scripting off nothing ever
 * flips it, so the copy would stay at `opacity: 0` forever. `<noscript>` is the
 * portable way to undo that: the `scripting` media feature only lands in Chrome
 * 120, Safari 17 and Firefox 113, which is above this project's browser target.
 */
const NO_SCRIPT_REVEAL_CSS =
  '<style>[data-reveal]{opacity:1;transform:translateY(0);filter:blur(0px);animation:none;will-change:auto}</style>';

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
      <noscript dangerouslySetInnerHTML={{ __html: NO_SCRIPT_REVEAL_CSS }} />
      {children}
    </>
  );
}
