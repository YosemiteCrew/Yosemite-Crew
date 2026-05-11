import { connection } from 'next/server';

import SessionInitializer from '@/app/ui/layout/SessionInitializer';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default async function AppLayout({ children }: Readonly<AppLayoutProps>) {
  await connection();

  return <SessionInitializer>{children}</SessionInitializer>;
}
