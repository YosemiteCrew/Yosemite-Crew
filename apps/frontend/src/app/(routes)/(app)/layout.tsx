import { connection } from 'next/server';

import SessionInitializer from '@/app/ui/layout/SessionInitializer';
import ThemeScript from '@/app/ui/theme/ThemeScript';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default async function AppLayout({ children }: Readonly<AppLayoutProps>) {
  await connection();

  return (
    <>
      <ThemeScript />
      {/* `display: contents` so this introduces no box and cannot disturb the
          height chains beneath it, while still passing the scoped faint-ink
          custom properties down - see [data-yc-app] in globals.css. PIMS sits
          on bone surfaces where the global faint inks are unreadable; the
          public marketing pages need the lighter values for their always-dark
          --spot panels, so the two cannot share one value. */}
      <div data-yc-app style={{ display: 'contents' }}>
        <SessionInitializer>{children}</SessionInitializer>
      </div>
    </>
  );
}
