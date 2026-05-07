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
    <div className="yc-hamburger-lines">
      <span
        className="yc-hamburger-line transition-transform duration-300"
        style={{
          transform: menuOpen ? 'rotate(45deg) translateY(6px)' : 'none',
        }}
      />
      <span
        className="yc-hamburger-line transition-opacity duration-300"
        style={{ opacity: menuOpen ? 0 : 1 }}
      />
      <span
        className="yc-hamburger-line transition-transform duration-300"
        style={{
          transform: menuOpen ? 'rotate(-45deg) translateY(-6px)' : 'none',
        }}
      />
    </div>
  </button>
);

export default HamburgerMenuButton;
