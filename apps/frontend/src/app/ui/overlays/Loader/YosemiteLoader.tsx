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
  let variantClass = 'yosemite-loader--inline';
  if (variant === 'fullscreen') {
    variantClass = 'yosemite-loader--fullscreen';
  } else if (variant === 'fullscreen-translucent') {
    variantClass = 'yosemite-loader--fullscreen-translucent';
  }

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
