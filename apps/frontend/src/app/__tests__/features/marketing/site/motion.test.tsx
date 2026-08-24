import React from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { render, screen, act, renderHook, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  Reveal,
  CountUp,
  HeroVideo,
  ScrollProgress,
  Tilt,
  Spotlight,
  useReducedMotion,
  useMagnet,
  useScrolled,
} from '@/app/features/marketing/site/motion';

const setReducedMotion = (matches: boolean) => {
  (globalThis as unknown as { matchMedia: unknown }).matchMedia = jest
    .fn()
    .mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
};

class FiringIO {
  private readonly cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
  }
  observe(node: Element) {
    this.cb(
      [{ isIntersecting: true, target: node } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [] as IntersectionObserverEntry[];
  }
}

describe('motion primitives', () => {
  const OriginalIO = globalThis.IntersectionObserver;
  const OriginalMM = (globalThis as unknown as { matchMedia: unknown }).matchMedia;

  beforeEach(() => {
    setReducedMotion(false);
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FiringIO;
  });
  afterEach(() => {
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = OriginalIO;
    (globalThis as unknown as { matchMedia: unknown }).matchMedia = OriginalMM;
  });

  it('useReducedMotion reflects the matchMedia preference', () => {
    setReducedMotion(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('Reveal reveals its children after being observed', () => {
    jest.useFakeTimers();
    try {
      render(<Reveal delay={10}>revealed content</Reveal>);
      const node = screen.getByText('revealed content');
      expect(node).toBeInTheDocument();
      // Hidden until the stagger delay elapses; marketing.css paints both states.
      expect(node).toHaveAttribute('data-reveal', 'hidden');
      act(() => {
        jest.runAllTimers();
      });
      expect(node).toHaveAttribute('data-reveal', 'shown');
    } finally {
      jest.useRealTimers();
    }
  });

  it('Reveal clears a pending stagger timer when it unmounts mid-reveal', () => {
    jest.useFakeTimers();
    const clear = jest.spyOn(globalThis, 'clearTimeout');
    try {
      const { unmount } = render(<Reveal delay={400}>unmounted content</Reveal>);
      unmount();
      expect(clear).toHaveBeenCalled();
      // Nothing left to fire, so no state update lands on the unmounted tree.
      act(() => {
        jest.runAllTimers();
      });
    } finally {
      clear.mockRestore();
      jest.useRealTimers();
    }
  });

  it('Reveal and CountUp render visible when IntersectionObserver is unavailable', () => {
    const io = globalThis.IntersectionObserver;
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      undefined as unknown as typeof IntersectionObserver;
    jest.useFakeTimers();
    try {
      render(<Reveal>no-observer content</Reveal>);
      render(<CountUp value="128" />);
      // Nothing can observe the element, so it settles itself rather than staying
      // hidden behind a reveal that will never be triggered.
      act(() => {
        jest.runAllTimers();
      });
      expect(screen.getByText('no-observer content')).toHaveAttribute('data-reveal', 'shown');
      expect(screen.getAllByText('128').at(-1)).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
      (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = io;
    }
  });

  it('Reveal forwards data attrs and leaves reduced motion to the stylesheet', () => {
    setReducedMotion(true);
    render(
      <Reveal as="section" data-stack-m="true">
        reduced content
      </Reveal>
    );
    const node = screen.getByText('reduced content');
    expect(node).toBeInTheDocument();
    expect(node).toHaveAttribute('data-stack-m', 'true');
    // The rendered markup must not depend on the motion preference - the
    // prefers-reduced-motion branch in marketing.css is what settles the element,
    // so it holds on the first paint instead of waiting for an effect.
    expect(node).toHaveAttribute('data-reveal');
    expect(node.getAttribute('style')).toBeNull();
  });

  it('Reveal server-renders the hidden state so the first client render matches', () => {
    const io = globalThis.IntersectionObserver;
    // The server has no IntersectionObserver; the browser that hydrates does.
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      undefined as unknown as typeof IntersectionObserver;
    const html = renderToString(<Reveal delay={0}>hydrated content</Reveal>);
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = io;

    expect(html).toContain('data-reveal="hidden"');

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    // A style/attribute mismatch is reported through console.error ("some attributes
    // of the server rendered HTML didn't match") and, when React can recover, through
    // onRecoverableError. Both must stay silent.
    const recoverable: unknown[] = [];
    const errors: unknown[] = [];
    const spy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      act(() => {
        root = hydrateRoot(container, <Reveal delay={0}>hydrated content</Reveal>, {
          onRecoverableError: (error) => recoverable.push(error),
        });
      });
    } finally {
      spy.mockRestore();
      // This root is created outside Testing Library, so its automatic cleanup does
      // not cover it. Unmounting runs the reveal effect's teardown and clears the
      // stagger timer; leaving it mounted leaks a live root into the whole worker.
      act(() => root?.unmount());
      container.remove();
    }

    expect(errors).toEqual([]);
    expect(recoverable).toEqual([]);
  });

  it('CountUp shows the formatted target under reduced motion', () => {
    setReducedMotion(true);
    render(<CountUp value="67,134" />);
    expect(screen.getAllByText('67,134').at(-1)).toBeInTheDocument();
  });

  it('CountUp renders non-numeric values verbatim', () => {
    render(<CountUp value="Coming soon" />);
    expect(screen.getAllByText('Coming soon').at(-1)).toBeInTheDocument();
  });

  it('CountUp animates to the target with requestAnimationFrame', () => {
    const raf = jest
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(performance.now() + 5000);
        return 1;
      });
    render(<CountUp value="3,210" className="stat" />);
    expect(screen.getAllByText('3,210').at(-1)).toBeInTheDocument();
    raf.mockRestore();
  });

  it('HeroVideo renders a decorative video layer with a theme-aware scrim', () => {
    const { container } = render(<HeroVideo src="https://x/v.mp4" position="center 50%" />);
    expect(container.querySelector('video')).toBeInTheDocument();
    // The scrim carries data-hero-scrim so it flips to the dark gradient in dark mode
    // instead of washing the hero to a muddy mid-tone.
    expect(container.querySelector('[data-hero-scrim]')).toBeInTheDocument();
  });

  it('HeroVideo renders nothing under reduced motion', () => {
    setReducedMotion(true);
    const { container } = render(<HeroVideo src="https://x/v.mp4" />);
    expect(container.querySelector('video')).not.toBeInTheDocument();
  });

  it('ScrollProgress renders and responds to scroll', () => {
    render(<ScrollProgress />);
    act(() => {
      fireEvent.scroll(globalThis.window);
    });
  });

  it('useScrolled becomes true past the threshold', () => {
    const { result } = renderHook(() => useScrolled(8));
    act(() => {
      Object.defineProperty(globalThis.window, 'scrollY', {
        value: 40,
        writable: true,
        configurable: true,
      });
      fireEvent.scroll(globalThis.window);
    });
    expect(result.current).toBe(true);
  });

  it('useScrolled server-renders false so hydration matches the server HTML', () => {
    const Probe = () => <span>{String(useScrolled(8))}</span>;
    expect(renderToString(<Probe />)).toContain('false');
  });

  it('useMagnet, Tilt and Spotlight wire cursor handlers under rich motion', () => {
    const Magnet = () => {
      const ref = useMagnet<HTMLButtonElement>();
      return (
        <button type="button" ref={ref}>
          magnet
        </button>
      );
    };
    render(<Magnet />);
    fireEvent.mouseMove(screen.getByText('magnet'));
    fireEvent.mouseLeave(screen.getByText('magnet'));

    render(
      <Tilt max={6}>
        <div>tilt</div>
      </Tilt>
    );
    fireEvent.mouseMove(screen.getByText('tilt'));
    fireEvent.mouseLeave(screen.getByText('tilt'));

    render(
      <Spotlight>
        <div>spot</div>
      </Spotlight>
    );
    const spot = screen.getByText('spot').parentElement as HTMLElement;
    fireEvent.mouseMove(spot);
    fireEvent.mouseLeave(spot);
  });
});
