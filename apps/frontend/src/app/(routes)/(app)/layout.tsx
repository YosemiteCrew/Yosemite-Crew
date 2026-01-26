import SessionInitializer from "@/app/components/SessionInitializer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <SessionInitializer>{children}</SessionInitializer>;
}
