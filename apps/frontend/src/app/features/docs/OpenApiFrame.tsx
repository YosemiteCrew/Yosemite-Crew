'use client';

const VIEWER_URL = '/static/openapi/viewer.html';
const SPEC_URL = '/static/openapi/openapi.yaml';
const VIEWER_READY = 'yc-openapi-viewer-ready';

/**
 * The Redoc viewer for the OpenAPI reference, framed with scripts only.
 *
 * The viewer is served from this origin, so allow-same-origin is left out on
 * purpose: the two together would let it lift its own sandbox. Without it the
 * frame runs in an opaque origin and cannot fetch the spec itself, so it asks
 * this page over a MessageChannel and gets the text back on that port. See
 * public/static/openapi/viewer.html for the other half.
 *
 * `src` is set only once the listener is attached, from the ref. Rendered in
 * the server markup, the frame could load and ask before hydration, and the
 * request would be lost. The ref's cleanup removes the listener again.
 */
const attachViewer = (frame: HTMLIFrameElement) => {
  const onMessage = (event: MessageEvent) => {
    // Only this frame may ask, and a sandboxed frame's origin is always "null".
    if (event.origin !== 'null' || event.source !== frame.contentWindow) return;
    const [port] = event.ports;
    if (event.data !== VIEWER_READY || !port) return;
    // A failed load leaves the viewer empty; the rest of the page is unaffected.
    fetch(SPEC_URL)
      .then((response) => (response.ok ? response.text() : null))
      .then((spec) => {
        if (spec !== null) port.postMessage(spec);
      })
      .catch(() => undefined);
  };

  globalThis.addEventListener('message', onMessage);
  frame.src = VIEWER_URL;
  return () => globalThis.removeEventListener('message', onMessage);
};

export default function OpenApiFrame() {
  return (
    <iframe
      ref={attachViewer}
      className="DocsOpenApiFrame"
      title="Yosemite Crew OpenAPI reference"
      sandbox="allow-scripts"
    />
  );
}
