'use strict';

// Where the hover thumbnail goes. The tab bar used to place it at the hovered
// tab's bottom edge with no upper bound, which in the 40px chrome strip put all
// but ~2px of it outside the view and made the feature invisible in every
// window (issue #3289). The view is grown to the whole window while a preview
// is up, so the only thing left to get right is that the thumbnail stays inside
// it - beside the rail in vertical mode, below the tab in horizontal.
//
// A plain browser script for the same reason as window-caption.js: the tab bar
// loads it over file:// under a strict CSP. The unit tests require it directly.
(function (root) {
  const WIDTH = 320;
  const HEIGHT = 200;
  const GAP = 4;

  // A window narrower or shorter than the preview has no in-bounds position;
  // pinning to the top-left corner at least keeps the near edge on screen,
  // whereas Math.min/Math.max composed the other way round would push it off.
  const clamp = function (value, limit) {
    if (limit <= 0) return 0;
    return Math.min(Math.max(value, 0), limit);
  };

  /**
   * @param rect      the hovered tab's bounding box, in view coordinates
   * @param viewport  { width, height } of the (expanded) chrome view
   * @param railWidth width of the vertical tab rail, or 0 in horizontal mode
   */
  const previewPosition = function (rect, viewport, railWidth) {
    const maxLeft = viewport.width - WIDTH;
    const maxTop = viewport.height - HEIGHT;
    if (railWidth > 0) {
      // Beside the rail, top-aligned with the tab: below it would run off the
      // bottom for any tab in the lower half of a full-height sidebar.
      return { left: clamp(railWidth + GAP, maxLeft), top: clamp(rect.top, maxTop) };
    }
    return {
      left: clamp(rect.left + (rect.width - WIDTH) / 2, maxLeft),
      top: clamp(rect.bottom + GAP, maxTop),
    };
  };

  const api = { previewPosition: previewPosition, WIDTH: WIDTH, HEIGHT: HEIGHT, GAP: GAP };
  root.ycTabPreviewPosition = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
