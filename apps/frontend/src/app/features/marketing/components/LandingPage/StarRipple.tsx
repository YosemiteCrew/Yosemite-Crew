'use client';
import React from 'react';
import { motion } from 'framer-motion';

// Pre-computed path for an 8-point smooth star (cx=500, cy=500, outer=400, inner=340).
// Hardcoded to avoid SSR/client floating-point divergence (Math.cos/sin differs between
// Node.js and browser engines, causing hydration mismatches).
const STAR_PATH =
  'M 500 100 C 565.0561835020653 99.99999999999999 559.4016888854758 156.59163706481726 630.1123670041305 185.88095894616254 C 700.8230451227853 215.17028082750778 736.8410439621923 171.1556190129543 782.842712474619 217.15728752538104 C 828.8443809870457 263.15895603780774 784.8297191724922 299.17695487721477 814.1190410538375 369.88763299586947 C 843.4083629351827 440.5983111145242 900 434.94381649793473 900 500 C 900 565.0561835020653 843.4083629351827 559.4016888854758 814.1190410538375 630.1123670041305 C 784.8297191724922 700.8230451227853 828.8443809870457 736.8410439621923 782.842712474619 782.842712474619 C 736.8410439621923 828.8443809870457 700.8230451227853 784.8297191724922 630.1123670041305 814.1190410538375 C 559.4016888854758 843.4083629351827 565.0561835020653 900 500 900 C 434.94381649793473 900 440.5983111145242 843.4083629351827 369.88763299586947 814.1190410538375 C 299.17695487721477 784.8297191724922 263.15895603780774 828.8443809870457 217.15728752538104 782.842712474619 C 171.15561901295433 736.8410439621923 215.17028082750784 700.8230451227853 185.8809589461626 630.1123670041306 C 156.59163706481732 559.4016888854759 100.00000000000001 565.0561835020653 100 500.00000000000006 C 99.99999999999999 434.94381649793473 156.59163706481726 440.5983111145242 185.88095894616254 369.88763299586935 C 215.17028082750772 299.1769548772147 171.15561901295425 263.15895603780774 217.15728752538092 217.15728752538104 C 263.1589560378076 171.15561901295433 299.1769548772146 215.1702808275078 369.8876329958693 185.8809589461626 C 440.59831111452417 156.5916370648173 434.9438164979347 100.00000000000001 500 100';

interface RippleProps {
  delay: number;
  duration: number;
  size: number;
  color: string;
  position: 'top-right' | 'bottom-left';
  gradientId: string;
}

const Ripple: React.FC<RippleProps> = ({ delay, duration, size, color, position, gradientId }) => {
  const positionStyles =
    position === 'top-right' ? { right: '-50%', top: '-50%' } : { left: '-50%', bottom: '-50%' };

  return (
    <div
      style={{
        position: 'absolute',
        ...positionStyles,
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <motion.svg
        viewBox="0 0 1000 1000"
        className="star-ripple"
        style={{ width: '100%', height: '100%' }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{
          scale: [0.6, 1, 1.4],
          opacity: [0, 0.5, 0],
          rotate: [0, 8, 15],
        }}
        transition={{
          duration: duration,
          delay: delay,
          repeat: Infinity,
          repeatDelay: 0,
          ease: [0.4, 0, 0.2, 1],
        }}
      >
        <defs>
          <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1="100"
            y1="100"
            x2="900"
            y2="900"
          >
            <stop offset="0%" stopColor="#b8ddf5" stopOpacity="0.8" />
            <stop offset="30%" stopColor={color} stopOpacity="0.5" />
            <stop offset="50%" stopColor={color} stopOpacity="0.2" />
            <stop offset="70%" stopColor={color} stopOpacity="0.5" />
            <stop offset="100%" stopColor="#b8ddf5" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        <path
          d={STAR_PATH}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.svg>
    </div>
  );
};

const RIPPLE_COLORS = ['#7AB4F5', '#5299F1', '#3687EF', '#4a90d9'] as const;
const RIPPLE_SIZES = [1000, 1200, 1400, 1600] as const;
const RIPPLE_DELAYS = [0, 2.5, 5, 7.5] as const;
const DURATION = 10;

const StarRipple: React.FC = () => {
  const topRightRipples = [0, 1, 2, 3].map((i) => ({
    id: `yc-tr-${i}`,
    gradientId: `yc-grad-tr-${i}`,
    delay: RIPPLE_DELAYS[i],
    duration: DURATION,
    size: RIPPLE_SIZES[i],
    color: RIPPLE_COLORS[i],
    position: 'top-right' as const,
  }));

  const bottomLeftRipples = [0, 1, 2, 3].map((i) => ({
    id: `yc-bl-${i}`,
    gradientId: `yc-grad-bl-${i}`,
    delay: RIPPLE_DELAYS[i],
    duration: DURATION,
    size: RIPPLE_SIZES[i],
    color: RIPPLE_COLORS[i],
    position: 'bottom-left' as const,
  }));

  return (
    <div className="star-ripple-container">
      <div className="ripple-glow" />
      {topRightRipples.map(({ id, ...ripple }) => (
        <Ripple key={id} {...ripple} />
      ))}
      {bottomLeftRipples.map(({ id, ...ripple }) => (
        <Ripple key={id} {...ripple} />
      ))}
    </div>
  );
};

export default StarRipple;
