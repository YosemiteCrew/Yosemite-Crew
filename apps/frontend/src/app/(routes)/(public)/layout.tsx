import '@/app/features/marketing/site/marketing.css';

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
      <script
        // Resolve the theme before the marketing content paints so dark mode never
        // flashes. Reads the explicit choice (localStorage 'yc-theme') else the OS
        // preference. Public routes use a non-strict CSP (unsafe-inline allowed), so
        // this inline script needs no nonce; it lives here rather than the root layout
        // to stay off the nonce-CSP app routes.
        dangerouslySetInnerHTML={{
          __html:
            "(function(){try{var s=localStorage.getItem('yc-theme');var d=s?s==='dark':matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();",
        }}
      />
      {children}
    </>
  );
}
