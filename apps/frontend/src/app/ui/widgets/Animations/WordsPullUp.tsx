'use client';
import { LazyMotion, domAnimation, m, useInView } from 'framer-motion';
import * as React from 'react';

export function WordsPullUp({
  text,
  className = '',
  containerClassName = '',
  animateWords = true,
}: Readonly<{
  text: string;
  className?: string;
  containerClassName?: string;
  animateWords?: boolean;
}>) {
  const splittedText = text.split(' ');

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
  const isInView = useInView(ref, { once: true, margin: '-40% 0px -20% 0px' });

  return (
    <LazyMotion features={domAnimation}>
      <div className={`${containerClassName}`}>
        {splittedText.map((current, i) => (
          <m.div
            key={i + current}
            ref={ref}
            variants={pullupVariant}
            initial={animateWords ? 'initial' : false}
            animate={!animateWords || isInView ? 'animate' : ''}
            custom={i}
            className={`pr-2! ${className}`}
          >
            {current == '' ? <span>&nbsp;</span> : current}
          </m.div>
        ))}
      </div>
    </LazyMotion>
  );
}
