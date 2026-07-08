import { connection } from 'next/server';

import SessionInitializer from '@/app/ui/layout/SessionInitializer';
import { ThemeScript } from '@/app/ui/theme';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default async function AppLayout({ children }: Readonly<AppLayoutProps>) {
  await connection();

  return (
    <>
      <ThemeScript />
      <SessionInitializer>{children}</SessionInitializer>
    </>
  );
}
