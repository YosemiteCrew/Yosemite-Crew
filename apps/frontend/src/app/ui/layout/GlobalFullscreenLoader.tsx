import { YosemiteLoader } from '@/app/ui/overlays/Loader';

type GlobalFullscreenLoaderProps = {
  testId?: string;
};

const GlobalFullscreenLoader = ({ testId }: GlobalFullscreenLoaderProps) => {
  return (
    <YosemiteLoader
      variant="fullscreen-translucent"
      size={44}
      testId={testId ?? 'global-fullscreen-loader'}
    />
  );
};

export default GlobalFullscreenLoader;
