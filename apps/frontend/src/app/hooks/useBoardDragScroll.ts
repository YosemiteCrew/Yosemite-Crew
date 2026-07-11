import React, { RefObject, useCallback, useEffect } from 'react';

const EDGE_PX = 100;
const SPEED_PX = 24;

const getEdgeScrollDelta = (clientPosition: number, start: number, end: number): number => {
  if (clientPosition - start < EDGE_PX) return -SPEED_PX;
  if (end - clientPosition < EDGE_PX) return SPEED_PX;
  return 0;
};

const canScrollVertically = (el: HTMLElement, delta: number): boolean => {
  if (delta < 0) return el.scrollTop > 0;
  if (delta > 0) return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
  return false;
};

const canScrollHorizontally = (el: HTMLElement, delta: number): boolean => {
  if (delta < 0) return el.scrollLeft > 0;
  if (delta > 0) return el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
  return false;
};

export const useBoardDragScroll = () => {
  const autoScrollBoardOnDrag = useCallback(
    (event: React.DragEvent<HTMLElement>, innerScrollable?: HTMLElement | null) => {
      const innerRect = innerScrollable?.getBoundingClientRect();
      const deltaInnerY = innerRect
        ? getEdgeScrollDelta(event.clientY, innerRect.top, innerRect.bottom)
        : 0;
      if (
        innerScrollable &&
        deltaInnerY !== 0 &&
        canScrollVertically(innerScrollable, deltaInnerY)
      ) {
        innerScrollable.scrollBy({ top: deltaInnerY });
        return;
      }
      const boardRoot =
        event.currentTarget.closest<HTMLElement>('[data-board-scroll-root="true"]') ??
        event.currentTarget;
      const boardRect = boardRoot.getBoundingClientRect();
      const deltaBoardX = getEdgeScrollDelta(event.clientX, boardRect.left, boardRect.right);
      if (deltaBoardX !== 0 && canScrollHorizontally(boardRoot, deltaBoardX)) {
        boardRoot.scrollBy({ left: deltaBoardX });
      }
    },
    []
  );

  return { autoScrollBoardOnDrag };
};

type BoardColumn<Key extends string> = {
  key: Key;
};

type UseBoardColumnDropOptions<Key extends string> = {
  activeItemId: string | null;
  autoScrollBoardOnDrag: (
    event: React.DragEvent<HTMLElement>,
    innerScrollable?: HTMLElement | null
  ) => void;
  boardRootRef: RefObject<HTMLDivElement | null>;
  canDrop: boolean;
  columns: ReadonlyArray<BoardColumn<Key>>;
  columnDropRefs: RefObject<Partial<Record<Key, HTMLDivElement | null>>>;
  columnScrollRefs: RefObject<Partial<Record<Key, HTMLDivElement | null>>>;
  onDrop: (itemId: string, status: Key) => void;
};

export const useBoardColumnDrop = <Key extends string>({
  activeItemId,
  autoScrollBoardOnDrag,
  boardRootRef,
  canDrop,
  columns,
  columnDropRefs,
  columnScrollRefs,
  onDrop,
}: UseBoardColumnDropOptions<Key>) => {
  useEffect(() => {
    const boardRoot = boardRootRef.current;
    if (!boardRoot) return;

    const handleBoardDragOver = (event: DragEvent) => {
      if (!activeItemId || !canDrop) return;
      autoScrollBoardOnDrag(event as unknown as React.DragEvent<HTMLElement>);
    };

    boardRoot.addEventListener('dragover', handleBoardDragOver);
    return () => boardRoot.removeEventListener('dragover', handleBoardDragOver);
  }, [activeItemId, autoScrollBoardOnDrag, boardRootRef, canDrop]);

  useEffect(() => {
    const cleanups = columns.flatMap((column) => {
      const dropElement = columnDropRefs.current[column.key];
      const scrollElement = columnScrollRefs.current[column.key];
      if (!dropElement || !scrollElement) return [];

      const handleColumnDragOver = (event: DragEvent) => {
        if (!activeItemId || !canDrop) return;
        event.preventDefault();
        autoScrollBoardOnDrag(event as unknown as React.DragEvent<HTMLElement>);
      };

      const handleColumnDrop = (event: DragEvent) => {
        if (!activeItemId || !canDrop) return;
        event.preventDefault();
        onDrop(activeItemId, column.key);
      };

      const handleScrollDragOver = (event: DragEvent) => {
        if (!activeItemId || !canDrop) return;
        event.preventDefault();
        autoScrollBoardOnDrag(event as unknown as React.DragEvent<HTMLElement>, scrollElement);
      };

      dropElement.addEventListener('dragover', handleColumnDragOver);
      dropElement.addEventListener('drop', handleColumnDrop);
      scrollElement.addEventListener('dragover', handleScrollDragOver);

      return [
        () => dropElement.removeEventListener('dragover', handleColumnDragOver),
        () => dropElement.removeEventListener('drop', handleColumnDrop),
        () => scrollElement.removeEventListener('dragover', handleScrollDragOver),
      ];
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [
    activeItemId,
    autoScrollBoardOnDrag,
    canDrop,
    columns,
    columnDropRefs,
    columnScrollRefs,
    onDrop,
  ]);
};
