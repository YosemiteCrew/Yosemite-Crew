import React from 'react';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';

const Loading = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <YosemiteLoader label="Loading appointments" size={96} testId="appointments-route-loader" />
  </div>
);

export default Loading;
