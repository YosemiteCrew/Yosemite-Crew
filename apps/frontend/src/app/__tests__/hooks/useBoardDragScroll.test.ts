import { renderHook } from '@testing-library/react';
import { useBoardColumnDrop, useBoardDragScroll } from '@/app/hooks/useBoardDragScroll';

const makeScrollable = (
  opts: {
    scrollTop?: number;
    scrollLeft?: number;
    clientHeight?: number;
    scrollHeight?: number;
    clientWidth?: number;
    scrollWidth?: number;
    rect?: { top: number; bottom: number; left: number; right: number };
  } = {}
): HTMLElement & { scrollBy: jest.Mock } => {
  const el = document.createElement('div') as unknown as HTMLElement & { scrollBy: jest.Mock };
  const {
    scrollTop = 0,
    scrollLeft = 0,
    clientHeight = 500,
    scrollHeight = 1000,
    clientWidth = 800,
    scrollWidth = 1600,
    rect = { top: 0, bottom: 500, left: 0, right: 800 },
  } = opts;

  Object.defineProperty(el, 'scrollTop', { value: scrollTop, writable: true });
  Object.defineProperty(el, 'scrollLeft', { value: scrollLeft, writable: true });
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, writable: true });
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, writable: true });
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, writable: true });
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, writable: true });
  el.scrollBy = jest.fn();
  el.getBoundingClientRect = jest.fn().mockReturnValue(rect);
  return el;
};

describe('useBoardDragScroll', () => {
  it('returns autoScrollBoardOnDrag function', () => {
    const { result } = renderHook(() => useBoardDragScroll());
    expect(typeof result.current.autoScrollBoardOnDrag).toBe('function');
  });

  it('scrolls inner scrollable up when near top edge', () => {
    const { result } = renderHook(() => useBoardDragScroll());
    const inner = makeScrollable({ scrollTop: 100 });

    const event = {
      clientX: 400,
      clientY: 30, // near top edge (< 100px from top=0)
      currentTarget: document.createElement('div'),
    } as unknown as React.DragEvent<HTMLElement>;

    result.current.autoScrollBoardOnDrag(event, inner);
    expect(inner.scrollBy).toHaveBeenCalledWith({ top: -24 });
  });

  it('scrolls inner scrollable down when near bottom edge', () => {
    const { result } = renderHook(() => useBoardDragScroll());
    const inner = makeScrollable({ scrollTop: 0, scrollHeight: 1000, clientHeight: 500 });

    const event = {
      clientX: 400,
      clientY: 450, // near bottom edge (> 500-100=400)
      currentTarget: document.createElement('div'),
    } as unknown as React.DragEvent<HTMLElement>;

    result.current.autoScrollBoardOnDrag(event, inner);
    expect(inner.scrollBy).toHaveBeenCalledWith({ top: 24 });
  });

  it('does not scroll inner when at top going up (canScrollVertically=false)', () => {
    const { result } = renderHook(() => useBoardDragScroll());
    const inner = makeScrollable({ scrollTop: 0 }); // at top

    const boardRoot = makeScrollable({ scrollLeft: 100 });
    boardRoot.closest = jest.fn().mockReturnValue(boardRoot);

    const currentTarget = document.createElement('div');
    currentTarget.closest = jest.fn().mockReturnValue(boardRoot);

    const event = {
      clientX: 400,
      clientY: 30, // near top edge
      currentTarget,
    } as unknown as React.DragEvent<HTMLElement>;

    result.current.autoScrollBoardOnDrag(event, inner);
    // inner can't scroll up (scrollTop=0) so it falls through to board horizontal
    expect(inner.scrollBy).not.toHaveBeenCalled();
  });

  it('falls back to board horizontal scroll when no inner scrollable', () => {
    const { result } = renderHook(() => useBoardDragScroll());

    const boardRoot = makeScrollable({
      scrollLeft: 100,
      scrollWidth: 1600,
      clientWidth: 800,
      rect: { top: 0, bottom: 500, left: 0, right: 800 },
    });

    const currentTarget = document.createElement('div');
    currentTarget.closest = jest.fn().mockReturnValue(boardRoot);

    const event = {
      clientX: 30, // near left edge
      clientY: 250,
      currentTarget,
    } as unknown as React.DragEvent<HTMLElement>;

    result.current.autoScrollBoardOnDrag(event, null);
    expect(boardRoot.scrollBy).toHaveBeenCalledWith({ left: -24 });
  });

  it('scrolls board right when near right edge', () => {
    const { result } = renderHook(() => useBoardDragScroll());

    const boardRoot = makeScrollable({
      scrollLeft: 0,
      scrollWidth: 1600,
      clientWidth: 800,
      rect: { top: 0, bottom: 500, left: 0, right: 800 },
    });

    const currentTarget = document.createElement('div');
    currentTarget.closest = jest.fn().mockReturnValue(boardRoot);

    const event = {
      clientX: 780, // near right edge (> 800-100=700)
      clientY: 250,
      currentTarget,
    } as unknown as React.DragEvent<HTMLElement>;

    result.current.autoScrollBoardOnDrag(event, null);
    expect(boardRoot.scrollBy).toHaveBeenCalledWith({ left: 24 });
  });

  it('does not scroll when cursor is in middle', () => {
    const { result } = renderHook(() => useBoardDragScroll());
    const inner = makeScrollable({ scrollTop: 100 });

    const event = {
      clientX: 400,
      clientY: 250, // middle - no edge
      currentTarget: document.createElement('div'),
    } as unknown as React.DragEvent<HTMLElement>;

    result.current.autoScrollBoardOnDrag(event, inner);
    expect(inner.scrollBy).not.toHaveBeenCalled();
  });

  it('uses currentTarget as fallback when no board-scroll-root found', () => {
    const { result } = renderHook(() => useBoardDragScroll());

    const currentTarget = makeScrollable({
      scrollLeft: 100,
      scrollWidth: 1600,
      clientWidth: 800,
      rect: { top: 0, bottom: 500, left: 0, right: 800 },
    });
    currentTarget.closest = jest.fn().mockReturnValue(null);

    const event = {
      clientX: 30,
      clientY: 250,
      currentTarget,
    } as unknown as React.DragEvent<HTMLElement>;

    result.current.autoScrollBoardOnDrag(event);
    expect(currentTarget.scrollBy).toHaveBeenCalledWith({ left: -24 });
  });
});

describe('useBoardColumnDrop', () => {
  const setupColumnDrop = ({
    activeItemId = 'item-1',
    canDrop = true,
  }: {
    activeItemId?: string | null;
    canDrop?: boolean;
  } = {}) => {
    const boardRoot = document.createElement('div');
    const dropElement = document.createElement('div');
    const scrollElement = document.createElement('div');
    const autoScrollBoardOnDrag = jest.fn();
    const onDrop = jest.fn();

    renderHook(() =>
      useBoardColumnDrop({
        activeItemId,
        autoScrollBoardOnDrag,
        boardRootRef: { current: boardRoot },
        canDrop,
        columns: [{ key: 'PENDING' as const }],
        columnDropRefs: { current: { PENDING: dropElement } },
        columnScrollRefs: { current: { PENDING: scrollElement } },
        onDrop,
      })
    );

    return {
      autoScrollBoardOnDrag,
      boardRoot,
      dropElement,
      onDrop,
      scrollElement,
    };
  };

  it('auto-scrolls the board root while an item is dragged', () => {
    const { autoScrollBoardOnDrag, boardRoot } = setupColumnDrop();
    const event = new Event('dragover', { bubbles: true });

    boardRoot.dispatchEvent(event);

    expect(autoScrollBoardOnDrag).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'dragover' })
    );
  });

  it('prevents default and auto-scrolls the target column during drag over', () => {
    const { autoScrollBoardOnDrag, dropElement } = setupColumnDrop();
    const event = new Event('dragover', { bubbles: true, cancelable: true });

    dropElement.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(autoScrollBoardOnDrag).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'dragover' })
    );
  });

  it('drops the active item into the target column', () => {
    const { dropElement, onDrop } = setupColumnDrop();
    const event = new Event('drop', { bubbles: true, cancelable: true });

    dropElement.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onDrop).toHaveBeenCalledWith('item-1', 'PENDING');
  });

  it('auto-scrolls the inner column scroll container during drag over', () => {
    const { autoScrollBoardOnDrag, scrollElement } = setupColumnDrop();
    const event = new Event('dragover', { bubbles: true, cancelable: true });

    scrollElement.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(autoScrollBoardOnDrag).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'dragover' }),
      scrollElement
    );
  });

  it('ignores drag events when dropping is disabled', () => {
    const { autoScrollBoardOnDrag, dropElement, onDrop } = setupColumnDrop({ canDrop: false });

    dropElement.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
    dropElement.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));

    expect(autoScrollBoardOnDrag).not.toHaveBeenCalled();
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('removes event listeners on unmount', () => {
    const boardRoot = document.createElement('div');
    const dropElement = document.createElement('div');
    const scrollElement = document.createElement('div');
    const boardRemoveListener = jest.spyOn(boardRoot, 'removeEventListener');
    const dropRemoveListener = jest.spyOn(dropElement, 'removeEventListener');
    const scrollRemoveListener = jest.spyOn(scrollElement, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useBoardColumnDrop({
        activeItemId: 'item-1',
        autoScrollBoardOnDrag: jest.fn(),
        boardRootRef: { current: boardRoot },
        canDrop: true,
        columns: [{ key: 'PENDING' as const }],
        columnDropRefs: { current: { PENDING: dropElement } },
        columnScrollRefs: { current: { PENDING: scrollElement } },
        onDrop: jest.fn(),
      })
    );

    unmount();

    expect(boardRemoveListener).toHaveBeenCalledWith('dragover', expect.any(Function));
    expect(dropRemoveListener).toHaveBeenCalledWith('dragover', expect.any(Function));
    expect(dropRemoveListener).toHaveBeenCalledWith('drop', expect.any(Function));
    expect(scrollRemoveListener).toHaveBeenCalledWith('dragover', expect.any(Function));
  });
});
