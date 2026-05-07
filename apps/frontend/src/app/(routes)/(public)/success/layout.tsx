import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Success — Yosemite Crew' };

export default function SuccessLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
