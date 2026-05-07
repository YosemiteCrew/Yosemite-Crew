import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Chat — Yosemite Crew' };

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
