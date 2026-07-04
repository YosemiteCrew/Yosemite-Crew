'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

const EASE = 'cubic-bezier(0.16,1,0.3,1)';

/** True when the user asked the OS to reduce motion. Recomputed on preference change. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (globalThis.window === undefined || !globalThis.window.matchMedia) return undefined;
    const mq = globalThis.window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return reduced;
}

interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /** Stagger delay in ms once the element enters the viewport. */
  delay?: number;
  as?: 'div' | 'section' | 'li' | 'span';
}

/** Fade + rise + de-blur when scrolled into view. Renders visible immediately under reduced motion. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = 'div',
  style,
  ...rest
}: Readonly<RevealProps>) {
  const ref = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return undefined;
    }
    const node = ref.current;
    if (!node) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            globalThis.window.setTimeout(() => setShown(true), delay);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [reduced, delay]);

  const motionStyle: CSSProperties = reduced
    ? {}
    : {
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0px)' : 'translateY(34px)',
        filter: shown ? 'blur(0px)' : 'blur(8px)',
        transition: `opacity 1s ${EASE}, transform 1s ${EASE}, filter 1s ${EASE}`,
        willChange: 'opacity, transform',
      };

  const Tag = as;
  return (
    <Tag ref={ref as never} className={className} style={{ ...motionStyle, ...style }} {...rest}>
      {children}
    </Tag>
  );
}

/** Cursor-tracking magnetic pull for a button/link. Returns a ref to spread onto the element. */
export function useMagnet<T extends HTMLElement = HTMLElement>(strength = 0.24) {
  const ref = useRef<T | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced) return undefined;
    node.style.transition = `transform 0.35s ${EASE}`;
    const onMove = (event: MouseEvent) => {
      const rect = node.getBoundingClientRect();
      const mx = event.clientX - rect.left - rect.width / 2;
      const my = event.clientY - rect.top - rect.height / 2;
      node.style.transform = `translate(${(mx * strength).toFixed(1)}px, ${(my * strength * 1.2).toFixed(1)}px)`;
    };
    const onLeave = () => {
      node.style.transform = 'translate(0, 0)';
    };
    node.addEventListener('mousemove', onMove);
    node.addEventListener('mouseleave', onLeave);
    return () => {
      node.removeEventListener('mousemove', onMove);
      node.removeEventListener('mouseleave', onLeave);
    };
  }, [reduced, strength]);

  return ref;
}

interface TiltProps {
  children: ReactNode;
  /** Max rotation in degrees. */
  max?: number;
  className?: string;
  style?: CSSProperties;
}

/** Cursor-driven 3D tilt. Flat under reduced motion. */
export function Tilt({ children, max = 6, className, style }: Readonly<TiltProps>) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced) return undefined;
    node.style.transition = `transform 320ms ${EASE}`;
    node.style.willChange = 'transform';
    const onMove = (event: MouseEvent) => {
      const rect = node.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      node.style.transform = `perspective(1100px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`;
    };
    const onLeave = () => {
      node.style.transform = 'perspective(1100px) rotateX(0deg) rotateY(0deg)';
    };
    node.addEventListener('mousemove', onMove);
    node.addEventListener('mouseleave', onLeave);
    return () => {
      node.removeEventListener('mousemove', onMove);
      node.removeEventListener('mouseleave', onLeave);
    };
  }, [reduced, max]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}

interface SpotlightProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Cursor-following radial glow layer for dark sections. */
export function Spotlight({ children, className, style }: Readonly<SpotlightProps>) {
  const ref = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    const glow = glowRef.current;
    if (!node || !glow || reduced) return undefined;
    const onMove = (event: MouseEvent) => {
      const rect = node.getBoundingClientRect();
      const x = (event.clientX - rect.left).toFixed(0);
      const y = (event.clientY - rect.top).toFixed(0);
      glow.style.background = `radial-gradient(380px circle at ${x}px ${y}px, rgba(90,160,255,0.16), rgba(90,160,255,0.05) 46%, transparent 72%)`;
      glow.style.opacity = '1';
    };
    const onLeave = () => {
      glow.style.opacity = '0';
    };
    node.addEventListener('mousemove', onMove);
    node.addEventListener('mouseleave', onLeave);
    return () => {
      node.removeEventListener('mousemove', onMove);
      node.removeEventListener('mouseleave', onLeave);
    };
  }, [reduced]);

  return (
    <div ref={ref} className={className} style={{ position: 'relative', ...style }}>
      <div
        ref={glowRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0,
          transition: 'opacity 500ms ease',
        }}
      />
      {children}
    </div>
  );
}

interface HeroVideoProps {
  src: string;
  /** object-position, e.g. 'center 42%'. */
  position?: string;
}

/** Ambient looping hero video with a warm scrim. Not rendered under reduced motion. */
export function HeroVideo({ src, position = 'center 42%' }: Readonly<HeroVideoProps>) {
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);
  if (reduced || failed) return null;

  return (
    <>
      <video
        data-hero-video=""
        muted
        autoPlay
        loop
        playsInline
        aria-hidden="true"
        onError={() => setFailed(true)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100vh',
          objectFit: 'cover',
          objectPosition: position,
          opacity: 0.3,
          filter: 'blur(1px) saturate(200%) brightness(0.8)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <source src={src} type="video/mp4" />
      </video>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '100vh',
          zIndex: 1,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, rgba(239,232,220,0.66) 0%, rgba(239,232,220,0.54) 40%, rgba(239,232,220,0.22) 64%, rgba(239,232,220,0) 86%)',
        }}
      />
    </>
  );
}

/** Thin gradient scroll-progress bar fixed to the top of the viewport. */
export function ScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const update = () => {
      const height = document.documentElement.scrollHeight - globalThis.window.innerHeight;
      setPct(height > 0 ? (globalThis.window.scrollY / height) * 100 : 0);
    };
    globalThis.window.addEventListener('scroll', update, { passive: true });
    globalThis.window.addEventListener('resize', update);
    update();
    return () => {
      globalThis.window.removeEventListener('scroll', update);
      globalThis.window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '2px',
        width: `${pct}%`,
        background: 'linear-gradient(90deg,#257bed,#5ce1e6)',
        zIndex: 130,
        transition: 'width 80ms linear',
        pointerEvents: 'none',
      }}
    />
  );
}

interface CountUpProps {
  /** Final value, e.g. '67,134' or '2.4k'. Non-numeric text renders verbatim. */
  value: string;
  className?: string;
  style?: CSSProperties;
}

/** Animates a numeric value up from zero when scrolled into view. */
export function CountUp({ value, className, style }: Readonly<CountUpProps>) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const [inView, setInView] = useState(false);

  const target = useMemo(() => {
    const raw = value.replace(/,/g, '');
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [value]);

  const suffix = useMemo(() => (value.match(/[^\d,]+$/) ?? [''])[0], [value]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const node = ref.current;
    if (!node) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.35 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (target === null) {
      setDisplay(value);
      return undefined;
    }
    if (!inView) return undefined;
    if (reduced) {
      setDisplay(target.toLocaleString('en-US') + suffix);
      return undefined;
    }
    const duration = 1500;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(target * eased).toLocaleString('en-US') + suffix);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduced, target, suffix, value]);

  return (
    <span ref={ref} className={className} style={style}>
      {display}
    </span>
  );
}

/** Tracks whether the page has scrolled past the top, for nav glass elevation. */
export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false);
  const onScroll = useCallback(
    () => setScrolled(globalThis.window.scrollY > threshold),
    [threshold]
  );

  useEffect(() => {
    globalThis.window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => globalThis.window.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  return scrolled;
}
