import Cookies from "@/app/ui/widgets/Cookies/Cookies";
import Github from "@/app/ui/widgets/Github/Github";
import Header from "@/app/ui/layout/Header/Header";

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
