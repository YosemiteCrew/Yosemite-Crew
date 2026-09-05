import React from 'react';

type HamburgerMenuButtonProps = {
  menuOpen: boolean;
  onClick: () => void;
  controlsId?: string;
};

const HamburgerMenuButton = ({ menuOpen, onClick, controlsId }: HamburgerMenuButtonProps) => (
  <button
    type="button"
    className="yc-hamburger-button cursor-pointer lg:hidden"
    onClick={onClick}
    aria-label={menuOpen ? 'Close menu' : 'Open menu'}
    aria-expanded={menuOpen}
    aria-controls={controlsId}
  >
    <div className="relative flex items-center justify-center size-5">
      <span
        className="yc-hamburger-line absolute transition-transform duration-300"
        style={{
          transform: menuOpen ? 'rotate(45deg)' : 'translateY(-5px)',
        }}
      />
      <span
        className="yc-hamburger-line absolute transition-[opacity,transform] duration-300"
        style={{
          opacity: menuOpen ? 0 : 1,
          transform: menuOpen ? 'scaleX(0)' : 'none',
        }}
      />
      <span
        className="yc-hamburger-line absolute transition-transform duration-300"
        style={{
          transform: menuOpen ? 'rotate(-45deg)' : 'translateY(5px)',
        }}
      />
    </div>
  </button>
);

export default HamburgerMenuButton;
