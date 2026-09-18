import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Render a SERVER component the way production renders it.
 *
 * `@testing-library/react` drives the react-dom *client* renderer. From
 * react-dom 19.3.0 that renderer logs
 *
 *   "Encountered a script tag while rendering React component. Scripts inside
 *    React components are never executed when rendering on the client."
 *
 * for any host `<script>`, and `jest.setup.ts` turns a `console.error` into a
 * thrown Error - so a server component that inlines a script could not be
 * rendered through it at all.
 *
 * The warning is correct about the client: a `<script>` the client renderer
 * creates never executes. It does not describe these components. The theme
 * pre-paint script is inlined by server components that reach the browser as
 * HTML, where the browser parses and runs it before paint - which is the whole
 * point of it. Rendering them here through `react-dom/server` asserts against
 * the rendering mode they actually have, rather than silencing a warning about
 * a mode they never run in.
 *
 * Returns the server's HTML and that HTML parsed into a detached container.
 * Parsing via `innerHTML` deliberately does not execute the script, so the
 * container holds the element to assert on and nothing runs.
 */
export const renderServerComponent = (
  element: ReactElement
): { html: string; container: HTMLElement } => {
  const html = renderToStaticMarkup(element);
  const container = document.createElement('div');
  container.innerHTML = html;
  return { html, container };
};
