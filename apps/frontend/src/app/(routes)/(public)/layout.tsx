import Cookies from "@/app/components/Cookies/Cookies";
import Github from "@/app/components/Github/Github";
import Header from "@/app/components/Header/Header";

interface PublicLayoutProps {
  children: React.ReactNode;
}

export default function PublicLayout({ children }: Readonly<PublicLayoutProps>) {
  return (
    <>
      <Cookies />
      <Github />
      <Header />
      <div className="pt-20 flex-1 lg:pt-0">{children}</div>
    </>
  );
}
