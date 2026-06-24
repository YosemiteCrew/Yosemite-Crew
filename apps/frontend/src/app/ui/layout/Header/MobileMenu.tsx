import React, { useEffect } from 'react';

type MobileMenuProps = {
  isOpen: boolean;
  children: React.ReactNode;
  id?: string;
  onClose?: () => void;
};

const MobileMenu = ({ isOpen, children, id, onClose }: MobileMenuProps) => {
  useEffect(() => {
    if (!isOpen || !onClose) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <nav
      id={id}
      className={[
        'yc-mobile-menu-drawer z-999 fixed overflow-auto flex flex-col gap-3 lg:hidden',
        'transition-all duration-300 ease-[cubic-bezier(0.42,0,0.58,1)]',
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 max-h-0 pointer-events-none',
      ].join(' ')}
      aria-label="Mobile navigation"
      inert={!isOpen}
      hidden={!isOpen}
    >
      {children}
    </nav>
  );
};

export default MobileMenu;
