import SessionInitializer from "@/app/components/SessionInitializer";

interface AppLayoutProps {
  readonly children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return <SessionInitializer>{children}</SessionInitializer>;
}
