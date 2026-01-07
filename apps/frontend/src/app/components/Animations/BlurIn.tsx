'use client';
import { motion, useInView } from 'framer-motion';
import * as React from 'react';
 
export const BlurIn = ({ children }: { children: React.ReactNode }) => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true });
  return (
    <motion.h2
      ref={ref}
      initial={{ filter: 'blur(20px)', opacity: 0 }}
      animate={isInView ? { filter: 'blur(0px)', opacity: 1 } : {}}
      transition={{ duration: 1.2 }}
      className="text-xl text-center sm:text-4xl font-bold tracking-tighter md:text-6xl md:leading-16"
    >
      {children}
    </motion.h2>
  );
};