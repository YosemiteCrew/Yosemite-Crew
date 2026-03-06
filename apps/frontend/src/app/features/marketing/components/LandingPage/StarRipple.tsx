"use client";
import React from "react";
import { motion } from "framer-motion";

const generateSmoothStarPath = (
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  points: number = 8
): string => {
  const totalPoints = points * 2;
  const angleStep = (Math.PI * 2) / totalPoints;

  const starPoints: { x: number; y: number }[] = [];
  for (let i = 0; i < totalPoints; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = i * angleStep - Math.PI / 2;
    starPoints.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }

  const smoothness = 0.5;

  const getControlPoints = (p0: {x: number, y: number}, p1: {x: number, y: number}, p2: {x: number, y: number}) => {
    const d01 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const d12 = Math.hypot(p2.x - p1.x, p2.y - p1.y);

    const fa = smoothness * d01 / (d01 + d12);
    const fb = smoothness * d12 / (d01 + d12);

    const cp1x = p1.x - fa * (p2.x - p0.x);
    const cp1y = p1.y - fa * (p2.y - p0.y);
    const cp2x = p1.x + fb * (p2.x - p0.x);
    const cp2y = p1.y + fb * (p2.y - p0.y);

    return { cp1: { x: cp1x, y: cp1y }, cp2: { x: cp2x, y: cp2y } };
  };

  const controlPoints: { cp1: {x: number, y: number}, cp2: {x: number, y: number} }[] = [];
  for (let i = 0; i < totalPoints; i++) {
    const p0 = starPoints[(i - 1 + totalPoints) % totalPoints];
    const p1 = starPoints[i];
    const p2 = starPoints[(i + 1) % totalPoints];
    controlPoints.push(getControlPoints(p0, p1, p2));
  }

  let path = `M ${starPoints[0].x} ${starPoints[0].y}`;

  for (let i = 0; i < totalPoints; i++) {
    const nextIdx = (i + 1) % totalPoints;
    const cp1 = controlPoints[i].cp2;
    const cp2 = controlPoints[nextIdx].cp1;
    const end = starPoints[nextIdx];

    path += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y}`;
  }

  return path;
};

interface RippleProps {
  delay: number;
  duration: number;
  size: number;
  color: string;
  position: "top-right" | "bottom-left";
}

const Ripple: React.FC<RippleProps> = ({ delay, duration, size, color, position }) => {
  const starPath = generateSmoothStarPath(500, 500, 400, 340, 8);
  const gradientId = React.useId();

  const positionStyles = position === "top-right"
    ? { right: "-50%", top: "-50%" }
    : { left: "-50%", bottom: "-50%" };

  return (
    <div
      style={{
        position: "absolute",
        ...positionStyles,
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <motion.svg
        viewBox="0 0 1000 1000"
        className="star-ripple"
        style={{
          width: "100%",
          height: "100%",
        }}
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
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#247AED" stopOpacity="0.8" />
            <stop offset="30%" stopColor={color} stopOpacity="0.5" />
            <stop offset="50%" stopColor={color} stopOpacity="0.2" />
            <stop offset="70%" stopColor={color} stopOpacity="0.5" />
            <stop offset="100%" stopColor="#247AED" stopOpacity="0.8" />
            <animateTransform
              attributeName="gradientTransform"
              type="rotate"
              from="0 500 500"
              to="360 500 500"
              dur="4s"
              repeatCount="indefinite"
            />
          </linearGradient>
        </defs>
        <path
          d={starPath}
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

const RIPPLE_COLORS = ["#7AB4F5", "#5299F1", "#3687EF", "#247AED"] as const;
const RIPPLE_SIZES = [1000, 1200, 1400, 1600] as const;
const RIPPLE_DELAYS = [0, 2.5, 5, 7.5] as const;
const DURATION = 10;

const createRipple = (index: number, position: "top-right" | "bottom-left"): RippleProps & { id: string } => ({
  id: `${position === "top-right" ? "tr" : "bl"}-${index + 1}`,
  delay: RIPPLE_DELAYS[index],
  duration: DURATION,
  size: RIPPLE_SIZES[index],
  color: RIPPLE_COLORS[index],
  position,
});

const StarRipple: React.FC = () => {
  const topRightRipples = [0, 1, 2, 3].map((i) => createRipple(i, "top-right"));
  const bottomLeftRipples = [0, 1, 2, 3].map((i) => createRipple(i, "bottom-left"));

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
