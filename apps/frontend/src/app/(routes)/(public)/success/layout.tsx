import type { Metadata } from 'next';

// no-story: metadata-only Next.js layout (a bare <main> landmark), no visual content of its own
export const metadata: Metadata = { title: 'Success — Yosemite Crew' };

type SuccessLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function SuccessLayout({ children }: SuccessLayoutProps) {
  return (
    <main id="main-content" tabIndex={-1}>
      {children}
    </main>
  );
}
