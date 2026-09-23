import type { Metadata } from 'next';

// no-story: metadata-only Next.js layout, no visual content of its own
export const metadata: Metadata = { title: 'Chat — Yosemite Crew' };

type ChatLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function ChatLayout({ children }: ChatLayoutProps) {
  return <>{children}</>;
}
