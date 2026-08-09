'use client';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Walk from `target` up to (but not including) `boundary`, returning true if
 * any element along the way can still scroll vertically in the given direction.
 */
function hasVerticalScrollRoomBelow(
  target: EventTarget | null,
  boundary: HTMLElement,
  deltaY: number
): boolean {
  let node = target instanceof HTMLElement ? target : null;
  while (node && node !== boundary) {
    const style = globalThis.window?.getComputedStyle(node);
    const overflowY = style?.overflowY ?? '';
    if (overflowY === 'auto' || overflowY === 'scroll') {
      if (deltaY < 0 && node.scrollTop > 0) return true;
      if (deltaY > 0 && node.scrollTop + node.clientHeight < node.scrollHeight - 1) return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Walk from `boundary.parentElement` up the DOM, returning true if any
 * ancestor scroll container still has vertical scroll room.
 * Stops at the document body.
 */
function hasVerticalScrollRoomAbove(boundary: HTMLElement, deltaY: number): boolean {
  let node = boundary.parentElement;
  while (node) {
    const style = globalThis.window?.getComputedStyle(node);
    const overflowY = style?.overflowY ?? '';
    if (overflowY === 'auto' || overflowY === 'scroll') {
      if (deltaY < 0 && node.scrollTop > 0) return true;
      if (deltaY > 0 && node.scrollTop + node.clientHeight < node.scrollHeight - 1) return true;
    }
    node = node.parentElement;
  }
  return false;
}

const handledNativeWheelEvents = new WeakSet<Event>();
const wheelListenerByElement = new WeakMap<HTMLElement, EventListener>();

const scrollHorizontallyFromWheel = (
  event: Pick<WheelEvent, 'deltaY' | 'target' | 'cancelable' | 'preventDefault'>,
  boundary: HTMLElement,
  ignoreAncestors: boolean,
  shouldPreventDefault: boolean
) => {
  if (event.deltaY === 0) return;
  if (hasVerticalScrollRoomBelow(event.target, boundary, event.deltaY)) return;
  if (!ignoreAncestors && hasVerticalScrollRoomAbove(boundary, event.deltaY)) return;
  if (shouldPreventDefault && event.cancelable) {
    event.preventDefault();
  }
  boundary.scrollLeft += event.deltaY;
};

/**
 * Returns an onWheel handler that converts vertical mouse wheel delta into
 * horizontal scrolling — but only when:
 * 1. No vertically-scrollable descendant (between e.target and e.currentTarget)
 *    still has scroll room in that direction, AND
 * 2. No vertically-scrollable ancestor (above e.currentTarget) still has room.
 *
 * This means the page/layout scroll is always exhausted first; horizontal scroll
 * only kicks in once there is nowhere left to scroll vertically in the entire tree.
 *
 * Exception: containers that explicitly opt out of the ancestor check by passing
 * `ignoreAncestors={true}` (e.g. popovers rendered in a portal with no outer scroll).
 */
export const useWheelToHorizontalScroll = ({ ignoreAncestors = false } = {}) => {
  const ignoreAncestorsRef = useRef(ignoreAncestors);
  useEffect(() => {
    ignoreAncestorsRef.current = ignoreAncestors;
  });

  return useCallback((e: React.WheelEvent<HTMLElement>) => {
    const boundary = e.currentTarget;
    if (!wheelListenerByElement.has(boundary)) {
      const wheelListener: EventListener = (event) => {
        if (!(event instanceof WheelEvent)) return;
        handledNativeWheelEvents.add(event);
        scrollHorizontallyFromWheel(event, boundary, ignoreAncestorsRef.current, true);
      };
      boundary.addEventListener('wheel', wheelListener, { passive: false });
      wheelListenerByElement.set(boundary, wheelListener);
    }

    if (handledNativeWheelEvents.has(e.nativeEvent)) return;
    scrollHorizontallyFromWheel(e.nativeEvent, boundary, ignoreAncestorsRef.current, false);
  }, []);
};
