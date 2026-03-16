import React, { useCallback } from 'react';

const EDGE_PX = 56;
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
