import { YosemiteLoader } from '@/app/ui/overlays/Loader';

type GlobalFullscreenLoaderProps = {
  testId?: string;
};

const GlobalFullscreenLoader = ({ testId }: GlobalFullscreenLoaderProps) => {
  return (
    <YosemiteLoader
      variant="fullscreen-translucent"
      size={120}
      testId={testId ?? 'global-fullscreen-loader'}
    />
  );
};

export default GlobalFullscreenLoader;
