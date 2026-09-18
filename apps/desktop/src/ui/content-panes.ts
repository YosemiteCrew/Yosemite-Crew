'use strict';

import type { Rectangle, WebContentsView } from 'electron';

export type ContentPane = 'full' | 'left' | 'right';

export interface ContentBounds {
  width: number;
  height: number;
}

// The slice of the tab view host the layout needs: look a tab's view up, and
// move it.
export interface ContentPaneHost {
  get(id: string): WebContentsView | undefined;
  setBounds(id: string, bounds: Rectangle): unknown;
}

// The window's contentView, which owns the z-order of the mounted panes.
export interface ContentPaneSurface {
  addChildView(view: WebContentsView): unknown;
  removeChildView(view: WebContentsView): unknown;
}

export interface ContentPaneLayout {
  host: ContentPaneHost;
  surface: ContentPaneSurface;
  attachedTabId: string | null;
  splitId: string | null;
  // The tab mounted as the right-hand pane by the previous pass. splitId has
  // already been cleared by the time a layout runs after the split closes, so
  // this is the only handle on the view that is still covering half the window.
  mountedSplitId: string | null;
  bounds: ContentBounds;
  isVertical: boolean;
  chromeStripHeight: number;
  verticalTabWidth: number;
}

export const contentPaneWidth = (pane: ContentPane, full: number, half: number): number => {
  if (pane === 'full') return full;
  if (pane === 'left') return half;
  return full - half;
};

export const contentPaneBounds = (
  pane: ContentPane,
  b: ContentBounds,
  isVertical: boolean,
  chromeStripHeight: number,
  verticalTabWidth: number
): Rectangle => {
  if (isVertical) {
    const cw = Math.max(0, b.width - verticalTabWidth);
    const half = Math.floor(cw / 2);
    return {
      x: verticalTabWidth + (pane === 'right' ? half : 0),
      y: 0,
      width: contentPaneWidth(pane, cw, half),
      height: b.height,
    };
  }
  const half = Math.floor(b.width / 2);
  return {
    x: pane === 'right' ? half : 0,
    y: chromeStripHeight,
    width: contentPaneWidth(pane, b.width, half),
    height: Math.max(0, b.height - chromeStripHeight),
  };
};

// Lay the content area out for the current split state and return the tab that
// is now mounted as the right-hand pane (null when there is no split), for the
// caller to hand back on the next pass.
export const layoutContentPanes = (layout: ContentPaneLayout): string | null => {
  const { host, surface, attachedTabId, splitId, mountedSplitId, bounds } = layout;
  if (!attachedTabId) return mountedSplitId;

  const hasSplit = Boolean(splitId && host.get(splitId) && splitId !== attachedTabId);
  const nextSplitId = hasSplit ? splitId : null;
  const paneBounds = (pane: ContentPane): Rectangle =>
    contentPaneBounds(
      pane,
      bounds,
      layout.isVertical,
      layout.chromeStripHeight,
      layout.verticalTabWidth
    );

  // A split pane is added ABOVE the primary view, so once the split is closed or
  // moved to another tab the old pane keeps covering its half of the window and
  // keeps taking the input meant for the active tab. Detaching it is what ends
  // the split; clearing splitId on its own does not.
  if (mountedSplitId && mountedSplitId !== nextSplitId && mountedSplitId !== attachedTabId) {
    const stale = host.get(mountedSplitId);
    if (stale) surface.removeChildView(stale);
  }

  // In split view the primary tab takes the LEFT half (not the full width) so
  // the two views sit side by side instead of the split overlaying the primary.
  host.setBounds(attachedTabId, paneBounds(hasSplit ? 'left' : 'full'));
  if (!nextSplitId) return null;

  host.setBounds(nextSplitId, paneBounds('right'));
  const av = host.get(attachedTabId);
  const sv = host.get(nextSplitId);
  if (av) surface.addChildView(av);
  if (sv) surface.addChildView(sv);
  return nextSplitId;
};
