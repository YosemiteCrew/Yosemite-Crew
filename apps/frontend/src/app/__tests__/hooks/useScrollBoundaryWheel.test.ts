import { renderHook } from '@testing-library/react';
import { useScrollBoundaryWheel } from '@/app/hooks/useScrollBoundaryWheel';

const makeEl = (
  props: Partial<HTMLElement> = {},
  parent: HTMLElement | null = null
): HTMLElement => {
  const el = {
    scrollTop: 0,
    scrollHeight: 100,
    clientHeight: 100,
    parentElement: parent,
    ...props,
  } as unknown as HTMLElement;
  return el;
};

const makeWheelEvent = (currentTarget: HTMLElement, deltaY: number) =>
  ({ currentTarget, deltaY }) as unknown as React.WheelEvent<HTMLElement>;

describe('useScrollBoundaryWheel', () => {
  let getComputedStyleSpy: jest.SpyInstance;

  beforeEach(() => {
    getComputedStyleSpy = jest.spyOn(window, 'getComputedStyle');
  });

  afterEach(() => {
    getComputedStyleSpy.mockRestore();
  });

  it('does nothing when not at a boundary', () => {
    const { result } = renderHook(() => useScrollBoundaryWheel());
    const el = makeEl({ scrollTop: 50, scrollHeight: 100, clientHeight: 100 });

    result.current(makeWheelEvent(el, -10));

    expect(getComputedStyleSpy).not.toHaveBeenCalled();
  });

  it('forwards scroll to nearest scrollable ancestor when scrolling up at top', () => {
    const ancestor = makeEl({ scrollTop: 50 });
    const middle = makeEl({}, ancestor);
    const el = makeEl({ scrollTop: 0, parentElement: middle });

    getComputedStyleSpy.mockImplementation((node: HTMLElement) => ({
      overflowY: node === ancestor ? 'auto' : 'visible',
    })) as unknown as typeof window.getComputedStyle;

    const { result } = renderHook(() => useScrollBoundaryWheel());
    result.current(makeWheelEvent(el, -10));

    expect(ancestor.scrollTop).toBe(40);
  });

  it('forwards scroll to nearest scrollable ancestor when scrolling down at bottom', () => {
    const ancestor = makeEl({ scrollTop: 50 });
    const el = makeEl({
      scrollTop: 0,
      scrollHeight: 100,
      clientHeight: 100,
      parentElement: ancestor,
    });

    getComputedStyleSpy.mockImplementation(() => ({
      overflowY: 'scroll',
    })) as unknown as typeof window.getComputedStyle;

    const { result } = renderHook(() => useScrollBoundaryWheel());
    result.current(makeWheelEvent(el, 15));

    expect(ancestor.scrollTop).toBe(65);
  });

  it('does not throw when there is no scrollable ancestor', () => {
    const el = makeEl({ scrollTop: 0, parentElement: null });

    const { result } = renderHook(() => useScrollBoundaryWheel());

    expect(() => result.current(makeWheelEvent(el, -10))).not.toThrow();
  });

  it('skips non-scrollable ancestors while walking up the tree', () => {
    const scrollable = makeEl({ scrollTop: 10 });
    const nonScrollable = makeEl({}, scrollable);
    const el = makeEl({ scrollTop: 0, parentElement: nonScrollable });

    getComputedStyleSpy.mockImplementation((node: HTMLElement) => ({
      overflowY: node === scrollable ? 'auto' : 'static',
    })) as unknown as typeof window.getComputedStyle;

    const { result } = renderHook(() => useScrollBoundaryWheel());
    result.current(makeWheelEvent(el, -5));

    expect(scrollable.scrollTop).toBe(5);
  });
});
