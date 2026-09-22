import GlobalFullscreenLoader from '@/app/ui/layout/GlobalFullscreenLoader';

// no-story: thin wrapper around the already-storied GlobalFullscreenLoader, like the two sibling appointments loading files
/**
 * The route-transition fallback for the signed-in app.
 *
 * This used to be `src/app/loading.tsx` - a ROOT one, so it was the fallback
 * for every route in the application, the prerendered public marketing, legal
 * and documentation pages included. A `loading.tsx` is a Suspense boundary,
 * and React streams a boundary's content into a trailing `<div hidden id="S:n">`
 * and swaps it into place with an inline `$RC(...)` call. With scripting off
 * that call never runs, so on every public page the whole document stayed
 * inside the hidden div and the only thing a reader ever saw was this
 * fullscreen loader. See issue #3510.
 *
 * It belongs here rather than at the root because `(app)` is the group that
 * needs it and the only one that does. `(app)/layout.tsx` awaits
 * `connection()`, so every route beneath it is rendered on demand and has a
 * real server round-trip to cover, and all of it sits behind a session, where
 * a no-JavaScript floor means nothing. The public, booking and share groups
 * are prerendered or self-suspending, make no programmatic navigation, and now
 * serve a complete document.
 *
 * Note what this does NOT do, because it is easy to misread the move as
 * removing a fallback the initial document had: `(app)` routes are dynamic, so
 * this never appeared in their served HTML either before or after. What it
 * covers is a client-side transition that does not begin with an anchor click
 * - a `router.push()`. Anchor clicks are covered separately and app-wide by
 * `RouteLoaderOverlay`, which is mounted in the root layout.
 */
export default function Loading() {
  return <GlobalFullscreenLoader testId="app-route-loader" />;
}
