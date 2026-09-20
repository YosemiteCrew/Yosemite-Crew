import type { Metadata } from 'next';

// no-story: metadata-only Next.js layout, no visual content of its own
export const metadata: Metadata = {
  title: 'Report an Accessibility Barrier — Yosemite Crew',
  description: 'Tell us about an accessibility problem you encountered on Yosemite Crew.',
};

type ReportLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function ReportLayout({ children }: ReportLayoutProps) {
  return <>{children}</>;
}
