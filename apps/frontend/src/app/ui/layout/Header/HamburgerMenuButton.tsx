import React from "react";
import { motion } from "framer-motion";

type HamburgerMenuButtonProps = {
  menuOpen: boolean;
  onClick: () => void;
};

const line1Variants = {
  closed: { rotate: 0, y: 0 },
  open: { rotate: 45, y: 5 },
};

const line2Variants = {
  closed: { opacity: 1 },
  open: { opacity: 0 },
};

const line3Variants = {
  closed: { rotate: 0, y: 0 },
  open: { rotate: -45, y: -5 },
};

const HamburgerMenuButton = ({ menuOpen, onClick }: HamburgerMenuButtonProps) => (
  <button
    type="button"
    className="cursor-pointer h-10 w-10 rounded-full! border border-text-primary! bg-(--whitebg) lg:hidden"
    onClick={onClick}
    aria-label={menuOpen ? "Close menu" : "Open menu"}
  >
    <motion.div
      className="h-full w-full flex flex-col items-center justify-center gap-[3px]"
      initial={false}
      animate={menuOpen ? "open" : "closed"}
    >
      <motion.span
        variants={line1Variants}
        className="h-0.5 w-[15px] rounded-xs bg-text-primary origin-center"
      />
      <motion.span
        variants={line2Variants}
        className="h-0.5 w-[15px] rounded-xs bg-text-primary origin-center"
      />
      <motion.span
        variants={line3Variants}
        className="h-0.5 w-[15px] rounded-xs bg-text-primary origin-center"
      />
    </motion.div>
  </button>
);

export default HamburgerMenuButton;
