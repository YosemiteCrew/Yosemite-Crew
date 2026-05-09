import React from 'react';
import { motion } from 'framer-motion';

type HamburgerMenuButtonProps = {
  menuOpen: boolean;
  onClick: () => void;
};

const line1Variants = {
  closed: { rotate: 0, y: 0 },
  open: { rotate: 45, y: 6 },
};

const line2Variants = {
  closed: { opacity: 1 },
  open: { opacity: 0 },
};

const line3Variants = {
  closed: { rotate: 0, y: 0 },
  open: { rotate: -45, y: -6 },
};

const HamburgerMenuButton = ({ menuOpen, onClick }: HamburgerMenuButtonProps) => (
  <button
    type="button"
    className="yc-hamburger-button cursor-pointer lg:hidden"
    onClick={onClick}
    aria-label={menuOpen ? 'Close menu' : 'Open menu'}
  >
    <motion.div
      className="yc-hamburger-lines"
      initial={false}
      animate={menuOpen ? 'open' : 'closed'}
    >
      <motion.span variants={line1Variants} className="yc-hamburger-line" />
      <motion.span variants={line2Variants} className="yc-hamburger-line" />
      <motion.span variants={line3Variants} className="yc-hamburger-line" />
    </motion.div>
  </button>
);

export default HamburgerMenuButton;
