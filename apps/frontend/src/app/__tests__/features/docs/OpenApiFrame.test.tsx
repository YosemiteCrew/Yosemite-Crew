import { act, render, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import OpenApiFrame from '@/app/features/docs/OpenApiFrame';

const SPEC_URL = '/static/openapi/openapi.yaml';
const READY = 'yc-openapi-viewer-ready';

type Port = { postMessage: jest.Mock };

/*
 * A plain Event with the MessageEvent fields defined on it: jsdom has no
 * MessagePort to put in a real MessageEvent's `ports`, and the component only
 * reads these four fields.
 */
const message = (init: { origin: string; source: unknown; data: unknown; ports: Port[] }) => {
  const event = new Event('message');
  for (const [key, value] of Object.entries(init)) {
    Object.defineProperty(event, key, { value });
  }
  act(() => {
    globalThis.dispatchEvent(event);
  });
};

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

const mountFrame = () => {
  const { container, unmount } = render(<OpenApiFrame />);
  const frame = container.querySelector('iframe') as HTMLIFrameElement;
  return { frame, unmount };
};

describe('OpenApiFrame', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('spec') });
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('frames the viewer with scripts only', () => {
    const { frame } = mountFrame();

    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame).toHaveAttribute('title', 'Yosemite Crew OpenAPI reference');
    expect(frame.getAttribute('src')).toBe('/static/openapi/viewer.html');
  });

  // Rendered in the server markup, the frame could load and ask for the spec
  // before hydration attached the listener, and the request would be lost.
  it('leaves the viewer out of the server markup until the listener is attached', () => {
    expect(renderToStaticMarkup(<OpenApiFrame />)).not.toContain('src=');
  });

  it('answers the viewer on the port it sent, with the spec text', async () => {
    const { frame } = mountFrame();
    const port = { postMessage: jest.fn() };

    message({ origin: 'null', source: frame.contentWindow, data: READY, ports: [port] });

    await waitFor(() => expect(port.postMessage).toHaveBeenCalledWith('spec'));
    expect(fetchMock).toHaveBeenCalledWith(SPEC_URL);
  });

  it.each([
    ['another window', { origin: 'null', source: 'window', data: READY }],
    ['a real origin', { origin: 'https://example.com', source: 'frame', data: READY }],
    ['any other message', { origin: 'null', source: 'frame', data: 'hello' }],
  ])('ignores %s', async (_label, init) => {
    const { frame } = mountFrame();
    const port = { postMessage: jest.fn() };
    const source = init.source === 'frame' ? frame.contentWindow : globalThis;

    message({ ...init, source, ports: [port] });
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(port.postMessage).not.toHaveBeenCalled();
  });

  it('ignores a request that brings no port to answer on', async () => {
    const { frame } = mountFrame();

    message({ origin: 'null', source: frame.contentWindow, data: READY, ports: [] });
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends nothing when the spec does not load', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('Not found') });
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const { frame } = mountFrame();
    const port = { postMessage: jest.fn() };

    message({ origin: 'null', source: frame.contentWindow, data: READY, ports: [port] });
    message({ origin: 'null', source: frame.contentWindow, data: READY, ports: [port] });
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(port.postMessage).not.toHaveBeenCalled();
  });

  it('stops listening once unmounted', () => {
    const add = jest.spyOn(globalThis, 'addEventListener');
    const remove = jest.spyOn(globalThis, 'removeEventListener');
    try {
      const { unmount } = mountFrame();
      const listener = add.mock.calls.find(([type]) => type === 'message')?.[1];
      expect(listener).toBeDefined();

      unmount();

      expect(remove).toHaveBeenCalledWith('message', listener);
    } finally {
      add.mockRestore();
      remove.mockRestore();
    }
  });
});
