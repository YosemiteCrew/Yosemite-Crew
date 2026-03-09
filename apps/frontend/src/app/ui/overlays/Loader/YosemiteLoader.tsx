import React from 'react';
import Image from 'next/image';
import './YosemiteLoader.css';

type LoaderVariant = 'inline' | 'fullscreen' | 'fullscreen-translucent';

type YosemiteLoaderProps = {
  variant?: LoaderVariant;
  label?: string;
  size?: number;
  testId?: string;
};

const YosemiteLoader: React.FC<YosemiteLoaderProps> = ({
  variant = 'inline',
  label,
  size = 80,
  testId,
}) => {
  const variantClass =
    variant === 'fullscreen'
      ? 'yosemite-loader--fullscreen'
      : variant === 'fullscreen-translucent'
        ? 'yosemite-loader--fullscreen-translucent'
        : 'yosemite-loader--inline';

  return (
    <output className={`yosemite-loader ${variantClass}`} aria-live="polite" data-testid={testId}>
      <Image
        src="/assets/yosemiteLoader.gif"
        alt="Loading"
        width={size}
        height={size}
        unoptimized
        className="yosemite-loader__image"
      />
      {label ? <span className="yosemite-loader__label">{label}</span> : null}
    </output>
  );
};

export default YosemiteLoader;
