import React from "react";
import { motion, AnimatePresence } from "framer-motion";

type MobileMenuProps = {
  isOpen: boolean;
  children: React.ReactNode;
};

const MobileMenu = ({ isOpen, children }: MobileMenuProps) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{
          height: `calc(100vh - 80px)`,
          opacity: 1,
          transition: { duration: 0.4, ease: [0.42, 0, 0.58, 1] },
        }}
        exit={{
          height: 0,
          opacity: 0,
          transition: { duration: 0.3, ease: [0.42, 0, 0.58, 1] },
        }}
        style={{ top: "80px" }}
        className="px-3 sm:px-12! py-6 bg-white z-999 fixed left-0 w-screen overflow-auto flex flex-col gap-3"
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

export default MobileMenu;
