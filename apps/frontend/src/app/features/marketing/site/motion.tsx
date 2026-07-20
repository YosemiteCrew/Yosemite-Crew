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
const NUMERIC_CHAR = /[\d,]/;

/** Static base for the ambient hero video; objectPosition is applied inline per instance. */
const HERO_VIDEO_STYLE: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100vh',
  objectFit: 'cover',
  opacity: 0.3,
  filter: 'blur(1px) saturate(200%) brightness(0.8)',
  zIndex: 0,
  pointerEvents: 'none',
};

/** Warm scrim gradient layered over the hero video. */
const HERO_SCRIM_STYLE: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: '100vh',
  zIndex: 1,
  pointerEvents: 'none',
  background:
    'linear-gradient(180deg, rgba(239,232,220,0.66) 0%, rgba(239,232,220,0.54) 40%, rgba(239,232,220,0.22) 64%, rgba(239,232,220,0) 86%)',
};

/** Static base for the scroll-progress bar; width is applied inline from scroll state. */
const SCROLL_PROGRESS_STYLE: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  height: '2px',
  background: 'linear-gradient(90deg,var(--blue),var(--cyan))',
  zIndex: 130,
  transition: 'width 80ms linear',
  pointerEvents: 'none',
};

/** True when the user asked the OS to reduce motion. Recomputed on preference change. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (!globalThis.window?.matchMedia) return undefined;
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
  // Without IntersectionObserver (SSR / older browsers) content is visible from
  // the first paint; the observer below only drives the reveal when it exists.
  const [shown, setShown] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (reduced || typeof IntersectionObserver === 'undefined') return undefined;
    const node = ref.current;
    if (!node) return undefined;
    const reveal = () => setShown(true);
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries.find((e) => e.isIntersecting);
        if (entry) {
          globalThis.window.setTimeout(reveal, delay);
          io.unobserve(entry.target);
        }
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
  /** Poster image shown while the loop loads. */
  poster?: string;
  /** object-position, e.g. 'center 42%'. */
  position?: string;
}

/** Ambient looping hero video with a warm scrim. Not rendered under reduced motion. */
export function HeroVideo({ src, poster, position = 'center 42%' }: Readonly<HeroVideoProps>) {
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);
  if (reduced || failed) return null;

  // The whole decorative layer is hidden from assistive tech via this wrapper,
  // so aria-hidden stays off the (Sonar-focusable) <video> itself.
  return (
    <div aria-hidden="true">
      <video
        data-hero-video=""
        muted
        autoPlay
        loop
        playsInline
        poster={poster}
        onError={() => setFailed(true)}
        style={{ ...HERO_VIDEO_STYLE, objectPosition: position }}
      >
        <source src={src} type="video/mp4" />
      </video>
      <div data-hero-scrim="" style={HERO_SCRIM_STYLE} />
    </div>
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

  return <div aria-hidden="true" style={{ ...SCROLL_PROGRESS_STYLE, width: `${pct}%` }} />;
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
  // Without IntersectionObserver (SSR / older browsers) the value counts up from
  // the first paint; the observer below only gates it when it exists.
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');

  const target = useMemo(() => {
    const raw = value.replaceAll(',', '');
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [value]);

  // Trailing run of non-numeric characters (e.g. a unit suffix). Scanned from the
  // end in linear time to avoid the super-linear backtracking of /[^\d,]+$/.
  const suffix = useMemo(() => {
    let end = value.length;
    while (end > 0 && !NUMERIC_CHAR.test(value.charAt(end - 1))) end--;
    return value.slice(end);
  }, [value]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
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

/**
 * Mouse-driven depth parallax. Attach the returned ref to a scope element; any
 * descendant carrying `data-depth` (e.g. "0.05") drifts toward the cursor by that
 * factor while the pointer is over the scope. No-op under reduced motion.
 */
export function useParallax<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const zone = ref.current;
    if (reduced || !zone || !globalThis.window) return undefined;
    const layers = Array.from(zone.querySelectorAll<HTMLElement>('[data-depth]'));
    if (layers.length === 0) return undefined;

    const onMove = (event: MouseEvent) => {
      const rect = zone.getBoundingClientRect();
      if (event.clientY < rect.top - 40 || event.clientY > rect.bottom + 40) return;
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      for (const layer of layers) {
        const depth = Number.parseFloat(layer.dataset.depth ?? '0');
        layer.style.transform = `translate3d(${(-x * depth * 220).toFixed(1)}px, ${(
          -y *
          depth *
          220
        ).toFixed(1)}px, 0)`;
      }
    };

    globalThis.window.addEventListener('mousemove', onMove, { passive: true });
    return () => globalThis.window.removeEventListener('mousemove', onMove);
  }, [reduced]);

  return ref;
}

interface HeroGlowProps {
  /** Accent token for the radial glow, e.g. 'var(--glow-b09)'. */
  color: string;
  /** Absolute box (top/left/bottom/right/width/height) of the glow. */
  box: CSSProperties;
  /** ycDrift animation shorthand; omit for a static glow. */
  animation?: string;
  /** Parallax depth factor; the layer drifts toward the cursor by this amount. */
  depth?: string;
  /** Stack above a hero video/scrim when needed (parallax layer only). */
  zIndex?: number;
  /**
   * Wrap the glow in a `[data-depth]` parallax layer (default). Set false for a
   * bare glow placed directly in its section, matching a page with no parallax scope.
   */
  parallax?: boolean;
  /** Scroll-linked vertical drift factor for this glow (see ScrollDrift), e.g. '-0.05'. */
  scrollSpeed?: string;
}

/**
 * One ambient glow. By default it rides its own parallax-depth layer, so the glow
 * keeps its ycDrift while the layer drifts toward the cursor (see useParallax);
 * pass parallax={false} for a bare glow that sits directly in its section.
 */
export function HeroGlow({
  color,
  box,
  animation,
  depth = '0.05',
  zIndex,
  parallax = true,
  scrollSpeed,
}: Readonly<HeroGlowProps>) {
  const glow = (
    <div
      aria-hidden="true"
      data-scroll-speed={scrollSpeed}
      style={{
        position: 'absolute',
        ...box,
        background: `radial-gradient(closest-side, ${color}, transparent 70%)`,
        pointerEvents: 'none',
        animation,
      }}
    />
  );
  if (!parallax) return glow;
  return (
    <div
      data-depth={depth}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex }}
    >
      {glow}
    </div>
  );
}

/**
 * Scroll-linked vertical drift for every `[data-scroll-speed]` layer on the page
 * (attr value is the drift factor, e.g. '-0.05' rises as you scroll down). Renders
 * nothing and is inert under reduced motion; wire once inside the marketing shell.
 */
export function ScrollDrift() {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !globalThis.window) return undefined;
    const layers = Array.from(
      globalThis.document.querySelectorAll<HTMLElement>('[data-scroll-speed]')
    );
    if (layers.length === 0) return undefined;

    let ticking = false;
    const apply = () => {
      const vh = globalThis.window.innerHeight;
      for (const el of layers) {
        const rect = el.getBoundingClientRect();
        const off = (rect.top + rect.height / 2 - vh / 2) / vh;
        const speed = Number.parseFloat(el.dataset.scrollSpeed ?? '0');
        el.style.transform = `translate3d(0, ${(off * speed * vh).toFixed(1)}px, 0)`;
      }
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(apply);
      }
    };

    globalThis.window.addEventListener('scroll', onScroll, { passive: true });
    return () => globalThis.window.removeEventListener('scroll', onScroll);
  }, [reduced]);

  return null;
}

function underlinePath(padX: number, padY: number, w: number, h: number): string {
  const y = padY + h * 0.99;
  const x0 = padX - w * 0.02;
  const x1 = padX + w * 1.02;
  const s = x1 - x0;
  return (
    `M ${x0.toFixed(1)} ${(y - 1).toFixed(1)} C ${(x0 + s * 0.26).toFixed(1)} ${(y + 4.5).toFixed(1)}, ` +
    `${(x0 + s * 0.5).toFixed(1)} ${(y + 5).toFixed(1)}, ${(x0 + s * 0.68).toFixed(1)} ${(y + 1.5).toFixed(1)} ` +
    `S ${(x1 - s * 0.05).toFixed(1)} ${(y - 4.5).toFixed(1)}, ${x1.toFixed(1)} ${(y - 3).toFixed(1)}`
  );
}

function smoothPath(points: readonly (readonly [number, number])[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

function circlePath(padX: number, padY: number, w: number, h: number): string {
  const cx = padX + w / 2;
  const cy = padY + h / 2;
  const rx = w / 2 + Math.max(9, w * 0.06);
  const ry = h / 2 + Math.max(6, h * 0.14);
  const startAngle = -Math.PI * 0.6;
  const endAngle = startAngle + Math.PI * 2 * 1.09;
  const segments = 46;
  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = startAngle + (endAngle - startAngle) * t;
    const drift = 1 + Math.sin(a * 3 + 1.2) * 0.014;
    points.push([
      cx + Math.cos(a) * rx * drift + Math.sin(t * 7) * 0.7,
      cy + Math.sin(a) * ry * drift,
    ]);
  }
  return smoothPath(points);
}

interface InkAnnotateProps {
  children: ReactNode;
  /** 'circle' encircles the word; 'underline' draws a swoosh beneath it. */
  type?: 'circle' | 'underline';
  /** Draw delay in ms, to sync with a headline settling in. */
  delay?: number;
  /** Stroke colour; defaults to the word's own colour so it follows the theme. */
  color?: string;
  style?: CSSProperties;
}

/** Run a callback after two animation frames, letting a style reset paint first. */
const afterTwoFrames = (cb: () => void): void => {
  requestAnimationFrame(() => requestAnimationFrame(cb));
};

const INK_NS = 'http://www.w3.org/2000/svg';

interface InkOptions {
  type: 'circle' | 'underline';
  delay: number;
  color: string;
  reduced: boolean;
}

interface InkState {
  /** Whether the mark is currently fully drawn (shown) rather than retracted (hidden).
   *  Tracked explicitly so a resize re-fit never has to read visibility back from the
   *  serialized style — Safari/WebKit reports strokeDashoffset '0' as '0px', which would
   *  make a string check misread a visible mark as hidden and retract it on every resize. */
  revealed: boolean;
}

/** Fit the ink svg's viewBox/size and the path `d` to the host box. Shared by the first
 *  draw and every resize, so the mark always traces the word's current metrics. */
function setInkGeometry(
  svg: SVGSVGElement,
  path: SVGPathElement,
  w: number,
  h: number,
  type: 'circle' | 'underline'
): void {
  const padX = Math.max(14, w * 0.09);
  const padY = Math.max(11, h * 0.26);
  const fullW = w + padX * 2;
  const fullH = h + padY * 2;
  svg.setAttribute('viewBox', `0 0 ${fullW} ${fullH}`);
  svg.style.left = `${-padX}px`;
  svg.style.top = `${-padY}px`;
  svg.style.width = `${fullW}px`;
  svg.style.height = `${fullH}px`;
  path.setAttribute(
    'd',
    type === 'circle' ? circlePath(padX, padY, w, h) : underlinePath(padX, padY, w, h)
  );
}

/** Create the ink svg+path fitted to the host box, append it, and return both. */
function buildInkSvg(
  host: HTMLElement,
  w: number,
  h: number,
  opts: InkOptions
): { svg: SVGSVGElement; path: SVGPathElement } {
  const { type, color } = opts;
  const svg = globalThis.document.createElementNS(INK_NS, 'svg');
  svg.dataset.ink = '';
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;overflow:visible;pointer-events:none;z-index:-1;';
  const path = globalThis.document.createElementNS(INK_NS, 'path');
  path.setAttribute('stroke', color);
  path.setAttribute('stroke-width', String(type === 'circle' ? 2.4 : 3.4));
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('opacity', '0.9');
  setInkGeometry(svg, path, w, h, type);
  svg.appendChild(path);
  host.appendChild(svg);
  return { svg, path };
}

/** Wire draw-on-view / rewind-on-exit replay for a prepared ink path; returns its observer. */
function observeInkReplay(
  host: HTMLElement,
  path: SVGPathElement,
  opts: InkOptions,
  state: InkState
): IntersectionObserver | null {
  const len = path.getTotalLength();
  const dur = opts.type === 'circle' ? 1550 : 1150;
  let first = true;
  const reveal = () => {
    path.style.strokeDashoffset = '0';
  };
  const play = () => {
    path.style.transition = `stroke-dashoffset ${dur}ms cubic-bezier(0.6,0.04,0.28,1) ${first ? opts.delay : 220}ms`;
    first = false;
    state.revealed = true;
    afterTwoFrames(reveal);
  };
  const rewind = () => {
    path.style.transition = 'none';
    // Re-read the length: a mark refitted to a new size (refitInk) has a new dash array,
    // so hiding with the original `len` would leave part of a grown mark visible.
    path.style.strokeDashoffset = String(path.getTotalLength());
    state.revealed = false;
    path.getBoundingClientRect();
  };
  path.style.strokeDasharray = String(len);
  path.style.strokeDashoffset = String(len);
  if (typeof IntersectionObserver === 'undefined') {
    play();
    return null;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.intersectionRatio >= 0.55) play();
        else if (!entry.isIntersecting && !first) rewind();
      }
    },
    { threshold: [0, 0.55] }
  );
  io.observe(host);
  return io;
}

/** Re-fit an already-drawn ink mark to a new box size, preserving whether it is currently
 *  shown or hidden (so a resize re-shapes the mark without replaying its draw animation). */
function refitInk(
  svg: SVGSVGElement,
  path: SVGPathElement,
  w: number,
  h: number,
  opts: InkOptions,
  revealed: boolean
): void {
  setInkGeometry(svg, path, w, h, opts.type);
  if (opts.reduced) return;
  const len = path.getTotalLength();
  path.style.transition = 'none';
  path.style.strokeDasharray = String(len);
  path.style.strokeDashoffset = revealed ? '0' : String(len);
}

/** Draw the ink mark (once fonts settle), wire its replay, and keep it fitted to the word
 *  as the viewport resizes (headlines reflow/rescale, so the mark must re-trace). */
function runInkAnnotation(host: HTMLElement, opts: InkOptions): () => void {
  let io: IntersectionObserver | null = null;
  let ro: ResizeObserver | null = null;
  let raf = 0;
  let resizeRaf = 0;
  let svg: SVGSVGElement | null = null;
  let path: SVGPathElement | null = null;
  let lastW = 0;
  let lastH = 0;
  const state: InkState = { revealed: false };

  const relayout = () => {
    resizeRaf = 0;
    const w = host.offsetWidth;
    const h = host.offsetHeight;
    // Re-trace only when the box changed to a real (non-zero) new size.
    if (!svg || !path || !w || !h || (w === lastW && h === lastH)) return;
    lastW = w;
    lastH = h;
    refitInk(svg, path, w, h, opts, state.revealed);
  };

  // Coalesce a burst of resize notifications into a single re-fit on the next frame.
  const scheduleRelayout = () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(relayout);
  };

  const observeResize = () => {
    // The host is an inline <span>, and ResizeObserver does not fire for inline-level boxes,
    // so the window 'resize' event is the reliable trigger when a headline reflows/rescales.
    // The observer is kept for the box changes it does cover (e.g. a late web-font swap).
    globalThis.window.addEventListener('resize', scheduleRelayout);
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(scheduleRelayout);
      ro.observe(host);
    }
  };

  const draw = () => {
    const w = host.offsetWidth;
    const h = host.offsetHeight;
    if (!w || !h) {
      raf = requestAnimationFrame(draw);
      return;
    }
    const built = buildInkSvg(host, w, h, opts);
    svg = built.svg;
    path = built.path;
    lastW = w;
    lastH = h;
    if (opts.reduced) {
      // The reduced-motion mark carries no dash, so it is drawn (shown) from the start.
      state.revealed = true;
    } else {
      io = observeInkReplay(host, path, opts, state);
    }
    observeResize();
  };

  const fonts = globalThis.document.fonts;
  // Wait for webfonts so the ink traces the final glyph metrics, not the fallback.
  if (fonts) {
    fonts.ready.then(() => {
      raf = requestAnimationFrame(draw);
    });
  } else {
    raf = requestAnimationFrame(draw);
  }

  return () => {
    cancelAnimationFrame(raf);
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    globalThis.window.removeEventListener('resize', scheduleRelayout);
    ro?.disconnect();
    io?.disconnect();
    host.querySelectorAll('[data-ink]').forEach((node) => node.remove());
  };
}

/**
 * Hand-drawn "ink" annotation that draws an encircle or swoosh underline onto an
 * accent word with a luxe pen-on-paper easing, replaying whenever the word
 * re-enters view. Renders the mark already-drawn (no animation) under reduced motion.
 */
export function InkAnnotate({
  children,
  type = 'underline',
  delay = 0,
  color = 'currentColor',
  style,
}: Readonly<InkAnnotateProps>) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const host = ref.current;
    if (!host || !globalThis.document) return undefined;
    return runInkAnnotation(host, { type, delay, color, reduced });
  }, [type, delay, color, reduced]);

  return (
    <span ref={ref} style={{ position: 'relative', ...style }}>
      {children}
    </span>
  );
}
