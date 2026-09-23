import type { Metadata } from 'next';

// no-story: metadata-only Next.js layout (a bare <main> landmark), no visual content of its own
export const metadata: Metadata = { title: 'Payment Status — Yosemite Crew' };

type PaymentStatusLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function PaymentStatusLayout({ children }: PaymentStatusLayoutProps) {
  return (
    <main id="main-content" tabIndex={-1}>
      {children}
    </main>
  );
}
