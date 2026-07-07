import React, { useCallback, useRef, useState } from 'react';
import { Buffer } from 'buffer/';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

// This module is only ever evaluated in the browser: index.tsx loads it with
// React.lazy inside BrowserOnly. swagger-ui expects the Node Buffer global,
// so polyfill it before the component renders.
const globalScope = globalThis as unknown as Record<string, unknown>;
if (!globalScope.Buffer) {
  globalScope.Buffer = Buffer;
}

type SwaggerRequest = {
  url: string;
  loadSpec?: boolean;
  [key: string]: unknown;
};

export default function SwaggerView({ specUrl }: { specUrl: string }): React.ReactElement {
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const baseUrlRef = useRef('');

  const handleBaseUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setBaseUrlInput(event.target.value);
    baseUrlRef.current = event.target.value;
  };

  // Stable identity so SwaggerUI does not re-mount on every keystroke.
  const requestInterceptor = useCallback((req: SwaggerRequest) => {
    const override = baseUrlRef.current.trim();
    // Never rewrite the spec fetch itself, only "try it out" calls.
    if (req.loadSpec || override === '') {
      return req;
    }
    try {
      const target = new URL(req.url, window.location.origin);
      const origin = override.replace(/\/+$/, '');
      req.url = origin + target.pathname + target.search;
    } catch {
      // Leave the request untouched if the URL cannot be parsed.
    }
    return req;
  }, []);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        <label htmlFor="api-explorer-base-url" style={{ fontWeight: 600 }}>
          API base URL
        </label>
        <input
          id="api-explorer-base-url"
          type="url"
          placeholder="http://localhost:3000"
          value={baseUrlInput}
          onChange={handleBaseUrlChange}
          style={{
            flex: '1 1 260px',
            maxWidth: '480px',
            padding: '0.4rem 0.6rem',
            borderRadius: '6px',
            border: '1px solid var(--ifm-color-emphasis-300)',
            font: 'inherit',
          }}
        />
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--ifm-color-emphasis-700)' }}>
        Leave the base URL empty to send requests to this docs origin, or set it to the backend you
        want to test against (include the protocol, for example http://localhost:3000). Use the
        Authorize button below to paste an API key before trying an authenticated endpoint.
      </p>
      <div
        style={{
          background: '#ffffff',
          borderRadius: '8px',
          padding: '0.5rem',
          overflowX: 'auto',
        }}
      >
        {/* persistAuthorization intentionally omitted: it stores the pasted key
            in localStorage across browser restarts, a weaker custody posture
            than we want on a shared docs site. The key lives only for the tab. */}
        <SwaggerUI
          url={specUrl}
          tryItOutEnabled
          docExpansion="none"
          defaultModelsExpandDepth={-1}
          requestInterceptor={requestInterceptor}
        />
      </div>
    </div>
  );
}
