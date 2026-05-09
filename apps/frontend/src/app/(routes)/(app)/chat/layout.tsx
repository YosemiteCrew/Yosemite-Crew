import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Chat — Yosemite Crew' };

type ChatLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function ChatLayout({ children }: ChatLayoutProps) {
  return <>{children}</>;
}
