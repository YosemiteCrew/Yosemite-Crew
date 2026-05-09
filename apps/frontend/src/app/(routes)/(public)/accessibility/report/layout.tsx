import type { Metadata } from 'next';

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
