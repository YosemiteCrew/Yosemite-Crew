import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Payment Status — Yosemite Crew' };

export default function PaymentStatusLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
