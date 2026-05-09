import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Payment Status — Yosemite Crew' };

type PaymentStatusLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function PaymentStatusLayout({ children }: PaymentStatusLayoutProps) {
  return <>{children}</>;
}
