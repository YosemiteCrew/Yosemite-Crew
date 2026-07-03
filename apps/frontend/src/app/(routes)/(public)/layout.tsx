import Github from '@/app/ui/widgets/Github/Github';
import Header from '@/app/ui/layout/Header/Header';

interface PublicLayoutProps {
  children: React.ReactNode;
}

export default function PublicLayout({ children }: Readonly<PublicLayoutProps>) {
  return (
    <>
      <Github />
      <Header />
      <main id="main-content" tabIndex={-1} className="yc-public-page flex-1">
        {children}
      </main>
    </>
  );
}
