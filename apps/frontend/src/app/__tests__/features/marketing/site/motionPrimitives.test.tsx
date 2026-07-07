import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HeroGlow, InkAnnotate, useParallax } from '@/app/features/marketing/site/motion';

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
    | ((entries: Array<{ intersectionRatio: number; isIntersecting: boolean }>) => void)
    | null;

  beforeEach(() => {
    setReducedMotion(false);
    ioCallback = null;
    // jsdom reports 0 layout + no SVG geometry; stub what the draw needs.
    widthSpy = jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(80);
    heightSpy = jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(24);
    (
      globalThis.SVGElement.prototype as unknown as { getTotalLength: () => number }
    ).getTotalLength = () => 120;
    (globalThis as { IntersectionObserver: unknown }).IntersectionObserver = class {
      constructor(
        cb: (entries: Array<{ intersectionRatio: number; isIntersecting: boolean }>) => void
      ) {
        ioCallback = cb;
      }
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
