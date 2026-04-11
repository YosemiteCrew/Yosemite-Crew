"use client";
import { motion, useInView } from "framer-motion";
import * as React from "react";

export function WordsPullUp({
  text,
  className = "",
  containerClassName = "",
}: Readonly<{
  text: string;
  className?: string;
  containerClassName?: string;
}>) {
  const splittedText = text.split(" ");

  const pullupVariant = {
    initial: { y: 20, opacity: 0 },
    animate: (i: number) => ({
      y: 0,
      opacity: 1,
      transition: {
        delay: i * 0.1,
      },
    }),
  };
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-40% 0px -20% 0px" });

  return (
    <div className={`${containerClassName}`}>
      {splittedText.map((current, i) => (
        <motion.div
          key={i + current}
          ref={ref}
          variants={pullupVariant}
          initial="initial"
          animate={isInView ? "animate" : ""}
          custom={i}
          className={`pr-2! ${className}`}
        >
          {current == "" ? <span>&nbsp;</span> : current}
        </motion.div>
      ))}
    </div>
  );
}
