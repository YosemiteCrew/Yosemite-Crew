import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Developer Settings — Yosemite Crew' };

export default function DeveloperSettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
