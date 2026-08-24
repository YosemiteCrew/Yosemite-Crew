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

/**
 * The scroll case: the element is off-screen when the observer first reports, so
 * `Reveal` arms it, and `scrollIntoView()` then plays it. Held in a module-level
 * handle because the component constructs the observer itself.
 */
let scrollIntoView: (() => void) | null = null;
let offScreenAgain: (() => void) | null = null;

class ScrollIO {
  private readonly cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
  }
  observe(node: Element) {
    const fire = (isIntersecting: boolean) =>
      this.cb(
        [{ isIntersecting, target: node } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver
      );
    fire(false);
    scrollIntoView = () => fire(true);
    offScreenAgain = () => fire(false);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [] as IntersectionObserverEntry[];
  }
}

/** Reports a callback with no entries at all, which the spec permits. */
class EmptyIO {
  private readonly cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
  }
  observe() {
    this.cb([], this as unknown as IntersectionObserver);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [] as IntersectionObserverEntry[];
  }
}

/**
 * A fast scroll can move an element in and out between two rendering
 * opportunities, and the observer then delivers both records in one callback.
 * Reproduces that batch, intersection first and off-screen last.
 */
class BatchedIO {
  private readonly cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
  }
  observe(node: Element) {
    this.cb(
      [
        { isIntersecting: false, target: node } as IntersectionObserverEntry,
        { isIntersecting: true, target: node } as IntersectionObserverEntry,
        { isIntersecting: false, target: node } as IntersectionObserverEntry,
      ],
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

  it('Reveal arms off-screen, then plays when it scrolls into view', () => {
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = ScrollIO;
    jest.useFakeTimers();
    try {
      render(<Reveal delay={10}>revealed content</Reveal>);
      const node = screen.getByText('revealed content');
      // Off-screen, so hiding it costs the reader nothing and gives the
      // scroll-in something to animate from.
      expect(node).toHaveAttribute('data-reveal', 'hidden');
      act(() => scrollIntoView?.());
      act(() => {
        jest.runAllTimers();
      });
      expect(node).toHaveAttribute('data-reveal', 'shown');
    } finally {
      jest.useRealTimers();
    }
  });

  it('Reveal leaves an element already on screen settled rather than flashing it', () => {
    // FiringIO reports intersecting straight away, so the element was never armed.
    // Animating it in from hidden would only flash content the reader can see.
    jest.useFakeTimers();
    try {
      render(<Reveal delay={10}>on-screen content</Reveal>);
      act(() => {
        jest.runAllTimers();
      });
      expect(screen.getByText('on-screen content')).toHaveAttribute('data-reveal', 'idle');
    } finally {
      jest.useRealTimers();
    }
  });

  it('Reveal arms only once when the observer reports off-screen repeatedly', () => {
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = ScrollIO;
    const setState = jest.spyOn(React, 'useState');
    try {
      render(<Reveal>repeatedly reported</Reveal>);
      const node = screen.getByText('repeatedly reported');
      expect(node).toHaveAttribute('data-reveal', 'hidden');
      // A second off-screen report must not re-arm; the element is already hidden
      // and re-setting it would churn a render for nothing.
      const rendersAfterFirstArm = setState.mock.calls.length;
      act(() => offScreenAgain?.());
      expect(node).toHaveAttribute('data-reveal', 'hidden');
      expect(setState.mock.calls.length).toBe(rendersAfterFirstArm);
    } finally {
      setState.mockRestore();
    }
  });

  it('Reveal still plays when a fast scroll batches the intersection mid-callback', () => {
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = ScrollIO;
    jest.useFakeTimers();
    try {
      const { unmount } = render(<Reveal delay={5}>batched content</Reveal>);
      expect(screen.getByText('batched content')).toHaveAttribute('data-reveal', 'hidden');
      unmount();

      // Same element, now reported through a batch that ends off-screen. Reading
      // only the last record would strand it hidden for good.
      (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = BatchedIO;
      render(<Reveal delay={5}>batched content</Reveal>);
      act(() => {
        jest.runAllTimers();
      });
      expect(screen.getByText('batched content')).toHaveAttribute('data-reveal', 'idle');
    } finally {
      jest.useRealTimers();
    }
  });

  it('Reveal ignores an empty observer callback', () => {
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = EmptyIO;
    render(<Reveal>empty entries</Reveal>);
    // No entry means nothing to act on, so the element stays readable.
    expect(screen.getByText('empty entries')).toHaveAttribute('data-reveal', 'idle');
  });

  it('Reveal clears a pending stagger timer when it unmounts mid-reveal', () => {
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = ScrollIO;
    jest.useFakeTimers();
    const clear = jest.spyOn(globalThis, 'clearTimeout');
    try {
      const { unmount } = render(<Reveal delay={400}>unmounted content</Reveal>);
      act(() => scrollIntoView?.());
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
    try {
      render(<Reveal>no-observer content</Reveal>);
      render(<CountUp value="128" />);
      // Nothing can arm it, so it stays settled and readable rather than hidden
      // behind a reveal that nothing will ever trigger.
      expect(screen.getByText('no-observer content')).toHaveAttribute('data-reveal', 'idle');
      expect(screen.getAllByText('128').at(-1)).toBeInTheDocument();
    } finally {
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

  it('Reveal server-renders the settled state so the first client render matches', () => {
    const io = globalThis.IntersectionObserver;
    // The server has no IntersectionObserver; the browser that hydrates does.
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      undefined as unknown as typeof IntersectionObserver;
    const html = renderToString(<Reveal delay={0}>hydrated content</Reveal>);
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = io;

    // Only the client can arm a reveal, so the server's copy is always readable.
    expect(html).toContain('data-reveal="idle"');

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

  it('Tilt flattens when the cursor leaves the card', () => {
    render(
      <Tilt max={6}>
        <div>tilt-leave</div>
      </Tilt>
    );
    // The handlers sit on the Tilt wrapper, and mouseleave does not bubble, so it
    // has to be fired on the wrapper itself rather than the child.
    const wrapper = screen.getByText('tilt-leave').parentElement as HTMLElement;
    fireEvent.mouseMove(wrapper);
    expect(wrapper.style.transform).toContain('rotateX');
    fireEvent.mouseLeave(wrapper);
    expect(wrapper.style.transform).toBe('perspective(1100px) rotateX(0deg) rotateY(0deg)');
  });

  it('HeroVideo drops the decorative layer when the source fails to load', () => {
    const { container } = render(<HeroVideo src="https://x/broken.mp4" />);
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    // A dead CDN must not leave a black box behind the hero copy.
    fireEvent.error(video);
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
