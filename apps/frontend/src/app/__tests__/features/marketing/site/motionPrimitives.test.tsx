import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  HeroGlow,
  InkAnnotate,
  ScrollDrift,
  useParallax,
} from '@/app/features/marketing/site/motion';

const setReducedMotion = (reduced: boolean) => {
  (globalThis as { matchMedia: unknown }).matchMedia = jest.fn().mockReturnValue({
    matches: reduced,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
};

function ParallaxHarness({ withLayer = true }: { withLayer?: boolean }) {
  const ref = useParallax<HTMLDivElement>();
  return (
    <div ref={ref} data-testid="scope">
      {withLayer ? <div data-depth="0.1" data-testid="layer" /> : <span>no layers</span>}
    </div>
  );
}

describe('useParallax', () => {
  beforeEach(() => setReducedMotion(false));

  it('translates data-depth layers toward the cursor within the scope', () => {
    render(<ParallaxHarness />);
    const scope = screen.getByTestId('scope');
    scope.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 }) as DOMRect;
    fireEvent.mouseMove(globalThis.window, { clientX: 100, clientY: 100 });
    expect(screen.getByTestId('layer').style.transform).toContain('translate3d');
  });

  it('ignores pointer movement outside the scope vertical band', () => {
    render(<ParallaxHarness />);
    const scope = screen.getByTestId('scope');
    scope.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 }) as DOMRect;
    fireEvent.mouseMove(globalThis.window, { clientX: 50, clientY: 500 });
    expect(screen.getByTestId('layer').style.transform).toBe('');
  });

  it('does nothing when there are no depth layers', () => {
    render(<ParallaxHarness withLayer={false} />);
    fireEvent.mouseMove(globalThis.window, { clientX: 10, clientY: 10 });
    expect(screen.getByText('no layers')).toBeInTheDocument();
  });

  it('is inert under reduced motion', () => {
    setReducedMotion(true);
    render(<ParallaxHarness />);
    const scope = screen.getByTestId('scope');
    scope.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 }) as DOMRect;
    fireEvent.mouseMove(globalThis.window, { clientX: 100, clientY: 100 });
    expect(screen.getByTestId('layer').style.transform).toBe('');
  });
});

describe('InkAnnotate', () => {
  let widthSpy: jest.SpyInstance;
  let heightSpy: jest.SpyInstance;
  let ioCallback:
    ((entries: Array<{ intersectionRatio: number; isIntersecting: boolean }>) => void) | null;
  let inkLen: number;

  beforeEach(() => {
    setReducedMotion(false);
    ioCallback = null;
    inkLen = 120;
    // jsdom reports 0 layout + no SVG geometry; stub what the draw needs.
    widthSpy = jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(80);
    heightSpy = jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(24);
    (
      globalThis.SVGElement.prototype as unknown as { getTotalLength: () => number }
    ).getTotalLength = () => inkLen;
    (globalThis as { IntersectionObserver: unknown }).IntersectionObserver = class {
      constructor(
        cb: (entries: Array<{ intersectionRatio: number; isIntersecting: boolean }>) => void
      ) {
        ioCallback = cb;
      }
      observe() {}
      disconnect() {}
    };
    (globalThis as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    jest
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });
  });

  afterEach(() => {
    widthSpy.mockRestore();
    heightSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('renders the annotated word', () => {
    render(<InkAnnotate>whole</InkAnnotate>);
    expect(screen.getByText('whole')).toBeInTheDocument();
  });

  it('draws an animated underline and plays when the word enters view', () => {
    render(
      <InkAnnotate type="underline" delay={100}>
        grow
      </InkAnnotate>
    );
    const svg = document.querySelector('[data-ink]');
    expect(svg).not.toBeNull();
    act(() => ioCallback?.([{ intersectionRatio: 0.6, isIntersecting: true }]));
    act(() => ioCallback?.([{ intersectionRatio: 0, isIntersecting: false }]));
    expect(svg?.querySelector('path')).not.toBeNull();
  });

  it('draws a circle mark', () => {
    render(<InkAnnotate type="circle">whole</InkAnnotate>);
    expect(document.querySelector('[data-ink] path')).not.toBeNull();
  });

  it('renders the mark already-drawn under reduced motion', () => {
    setReducedMotion(true);
    render(<InkAnnotate type="circle">whole</InkAnnotate>);
    expect(document.querySelector('[data-ink]')).not.toBeNull();
  });

  // The host is an inline <span>; ResizeObserver does not fire for it, so a viewport
  // 'resize' is the real trigger when the headline reflows/rescales.
  const resizeViewport = () =>
    act(() => {
      globalThis.window.dispatchEvent(new Event('resize'));
    });

  it('re-traces the mark when the viewport resizes and the headline reflows', () => {
    render(<InkAnnotate type="circle">whole</InkAnnotate>);
    const svg = document.querySelector('[data-ink]');
    const before = svg?.getAttribute('viewBox');
    widthSpy.mockReturnValue(200);
    resizeViewport();
    const after = svg?.getAttribute('viewBox');
    expect(after).not.toEqual(before);
    expect(after).toContain('236'); // 200 + 2 * max(14, 200 * 0.09)
  });

  it('keeps an already-drawn mark visible through a resize', () => {
    render(<InkAnnotate type="underline">grow</InkAnnotate>);
    act(() => ioCallback?.([{ intersectionRatio: 0.6, isIntersecting: true }]));
    const path = document.querySelector('[data-ink] path') as SVGPathElement;
    expect(path.style.strokeDashoffset).toBe('0');
    widthSpy.mockReturnValue(160);
    resizeViewport();
    expect(path.style.strokeDashoffset).toBe('0');
  });

  it('keeps the mark shown on resize even when the offset serializes as "0px" (Safari)', () => {
    render(<InkAnnotate type="circle">whole</InkAnnotate>);
    act(() => ioCallback?.([{ intersectionRatio: 0.6, isIntersecting: true }])); // reveal -> shown
    const path = document.querySelector('[data-ink] path') as SVGPathElement;
    // WebKit reports strokeDashoffset '0' as '0px'; a string check would misread this as
    // hidden and retract the mark. Visibility is tracked in state, so it must stay shown.
    path.style.strokeDashoffset = '0px';
    widthSpy.mockReturnValue(200);
    resizeViewport();
    expect(path.style.strokeDashoffset).toBe('0');
  });

  it('retracts to the refitted length when scrolled out after the mark grows', () => {
    render(<InkAnnotate type="underline">grow</InkAnnotate>);
    act(() => ioCallback?.([{ intersectionRatio: 0.6, isIntersecting: true }])); // play -> shown
    const path = document.querySelector('[data-ink] path') as SVGPathElement;
    expect(path.style.strokeDashoffset).toBe('0');
    // The word grows on resize, so the traced path gets longer.
    inkLen = 200;
    widthSpy.mockReturnValue(200);
    resizeViewport();
    expect(path.style.strokeDasharray).toBe('200');
    // Scrolling out of view must retract to the NEW length, not the stale draw-time one.
    act(() => ioCallback?.([{ intersectionRatio: 0, isIntersecting: false }]));
    expect(path.style.strokeDashoffset).toBe('200');
  });

  it('ignores a resize that does not change the box', () => {
    render(<InkAnnotate type="circle">whole</InkAnnotate>);
    const svg = document.querySelector('[data-ink]');
    const before = svg?.getAttribute('viewBox');
    resizeViewport(); // still 80 x 24 → no re-trace
    expect(svg?.getAttribute('viewBox')).toEqual(before);
  });

  it('re-fits the static mark on resize under reduced motion', () => {
    setReducedMotion(true);
    render(<InkAnnotate type="circle">whole</InkAnnotate>);
    const svg = document.querySelector('[data-ink]');
    const path = document.querySelector('[data-ink] path') as SVGPathElement;
    const before = svg?.getAttribute('viewBox');
    widthSpy.mockReturnValue(200);
    resizeViewport();
    expect(svg?.getAttribute('viewBox')).not.toEqual(before);
    expect(path.style.strokeDasharray).toBe(''); // no dash animation under reduced motion
  });

  it('still re-traces on resize when ResizeObserver is unavailable', () => {
    const realRo = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = undefined;
    render(<InkAnnotate type="circle">whole</InkAnnotate>);
    const svg = document.querySelector('[data-ink]');
    const before = svg?.getAttribute('viewBox');
    widthSpy.mockReturnValue(200);
    resizeViewport(); // the window listener drives the re-fit with no ResizeObserver
    expect(svg?.getAttribute('viewBox')).not.toEqual(before);
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = realRo;
  });

  it('cancels a pending resize frame on unmount', () => {
    const { unmount } = render(<InkAnnotate type="circle">whole</InkAnnotate>);
    // Defer the next frame (return a handle without running it) so one stays pending.
    (globalThis.requestAnimationFrame as jest.Mock).mockImplementation(() => 42);
    widthSpy.mockReturnValue(200);
    resizeViewport();
    const cancelSpy = jest.spyOn(globalThis, 'cancelAnimationFrame');
    unmount();
    expect(cancelSpy).toHaveBeenCalledWith(42);
  });
});

describe('HeroGlow', () => {
  it('wraps the glow in a parallax depth layer by default', () => {
    const { container } = render(
      <HeroGlow
        color="var(--glow-b09)"
        box={{ top: 0, width: 100, height: 100 }}
        animation="ycDrift 30s ease-in-out infinite alternate"
        depth="0.06"
      />
    );
    const layer = container.querySelector('[data-depth="0.06"]');
    expect(layer).not.toBeNull();
    const glow = layer?.querySelector('[aria-hidden="true"]');
    expect(glow?.getAttribute('style')).toContain('var(--glow-b09)');
    expect(glow?.getAttribute('style')).toContain('ycDrift');
  });

  it('renders a bare static glow with no parallax wrapper when parallax is false', () => {
    const { container } = render(
      <HeroGlow
        parallax={false}
        color="var(--glow-b12)"
        box={{ bottom: 0, width: 80, height: 80 }}
      />
    );
    expect(container.querySelector('[data-depth]')).toBeNull();
    const glow = container.querySelector('[aria-hidden="true"]');
    expect(glow).not.toBeNull();
    expect(glow?.getAttribute('style')).toContain('var(--glow-b12)');
    expect(glow?.getAttribute('style')).not.toContain('animation');
  });
});

describe('ScrollDrift', () => {
  beforeEach(() => setReducedMotion(false));
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  const addLayer = (speed: string, top: number) => {
    const el = document.createElement('div');
    el.setAttribute('data-scroll-speed', speed);
    el.getBoundingClientRect = () =>
      ({ top, height: 100, left: 0, right: 0, bottom: top + 100, width: 0 }) as DOMRect;
    document.body.appendChild(el);
    return el;
  };

  it('drifts [data-scroll-speed] layers vertically on scroll', () => {
    jest
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });
    const layer = addLayer('-0.1', 900);
    render(<ScrollDrift />);
    fireEvent.scroll(globalThis.window);
    expect(layer.style.transform).toContain('translate3d');
  });

  it('is inert under reduced motion', () => {
    setReducedMotion(true);
    const layer = addLayer('-0.1', 900);
    render(<ScrollDrift />);
    fireEvent.scroll(globalThis.window);
    expect(layer.style.transform).toBe('');
  });

  it('renders nothing and no-ops when there are no drift layers', () => {
    const { container } = render(<ScrollDrift />);
    expect(container.firstChild).toBeNull();
  });
});
