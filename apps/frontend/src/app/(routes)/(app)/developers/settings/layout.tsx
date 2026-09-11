import type { Metadata } from 'next';

// no-story: metadata-only Next.js layout, no visual content of its own
export const metadata: Metadata = { title: 'Developer Settings — Yosemite Crew' };

type DeveloperSettingsLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function DeveloperSettingsLayout({ children }: DeveloperSettingsLayoutProps) {
  return <>{children}</>;
}
