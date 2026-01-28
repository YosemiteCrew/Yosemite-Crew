import SessionInitializer from "@/app/components/SessionInitializer";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: Readonly<AppLayoutProps>) {
  return <SessionInitializer>{children}</SessionInitializer>;
}
