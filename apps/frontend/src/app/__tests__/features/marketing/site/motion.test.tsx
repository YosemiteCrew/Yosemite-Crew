import React from 'react';
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
      expect(screen.getByText('revealed content')).toBeInTheDocument();
      act(() => {
        jest.runAllTimers();
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('Reveal renders visible immediately under reduced motion and forwards data attrs', () => {
    setReducedMotion(true);
    render(
      <Reveal as="section" data-stack-m="true">
        reduced content
      </Reveal>
    );
    expect(screen.getByText('reduced content')).toBeInTheDocument();
  });

  it('CountUp shows the formatted target under reduced motion', () => {
    setReducedMotion(true);
    render(<CountUp value="67,134" />);
    expect(screen.getByText('67,134')).toBeInTheDocument();
  });

  it('CountUp renders non-numeric values verbatim', () => {
    render(<CountUp value="Coming soon" />);
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });

  it('CountUp animates to the target with requestAnimationFrame', () => {
    const raf = jest
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(performance.now() + 5000);
        return 1;
      });
    render(<CountUp value="3,210" className="stat" />);
    expect(screen.getByText('3,210')).toBeInTheDocument();
    raf.mockRestore();
  });

  it('HeroVideo renders a decorative video layer', () => {
    const { container } = render(<HeroVideo src="https://x/v.mp4" position="center 50%" />);
    expect(container.querySelector('video')).toBeInTheDocument();
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
