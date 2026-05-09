import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Developer Settings — Yosemite Crew' };

type DeveloperSettingsLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function DeveloperSettingsLayout({ children }: DeveloperSettingsLayoutProps) {
  return <>{children}</>;
}
