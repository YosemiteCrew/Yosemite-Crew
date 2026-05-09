import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Success — Yosemite Crew' };

type SuccessLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function SuccessLayout({ children }: SuccessLayoutProps) {
  return <>{children}</>;
}
