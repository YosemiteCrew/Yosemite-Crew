// components/HeadLine.jsx
'use client';
import { motion } from 'framer-motion';

const headlineVariant = {
  hidden: { opacity: 0, x: -50 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6 } },
};

export default function HeadLine({ spnhead, blkhead }) {
  return (
    <motion.div
      className="SecHeading"
      variants={headlineVariant}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.4 }}
    >
      <h2>
        <span>{spnhead}</span> <br /> {blkhead}
      </h2>
    </motion.div>
  );
}