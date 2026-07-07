import React, { Suspense } from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import useBaseUrl from '@docusaurus/useBaseUrl';

// swagger-ui-react cannot render during SSR, so the real view is code-split
// and only ever loaded in the browser.
const SwaggerView = React.lazy(() => import('./SwaggerView'));

export default function ApiExplorer(): React.ReactElement {
  const specUrl = useBaseUrl('/openapi.yaml');
  const loading = <p>Loading API explorer...</p>;
  return (
    <BrowserOnly fallback={loading}>
      {() => (
        <Suspense fallback={loading}>
          <SwaggerView specUrl={specUrl} />
        </Suspense>
      )}
    </BrowserOnly>
  );
}
