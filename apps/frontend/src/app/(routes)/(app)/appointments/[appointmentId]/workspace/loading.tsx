import React from 'react';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';

const Loading = () => (
  <main className="w-full px-4 py-5 sm:px-6 lg:px-8">
    <div className="flex min-h-[60vh] items-center justify-center">
      <YosemiteLoader label="Loading workspace" size={96} testId="workspace-route-loader" />
    </div>
  </main>
);

export default Loading;
