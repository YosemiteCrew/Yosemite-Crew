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
    <output
      className={`yosemite-loader ${variantClass}`}
      aria-live="polite"
      aria-label={label ?? 'Loading'}
      data-testid={testId}
    >
      <Image
        alt="Loading"
        className="yosemite-loader__image"
        src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
        width={size}
        height={size}
        unoptimized
        style={{ width: size, height: size }}
      />
      {label ? (
        <span className="yosemite-loader__label">{label}</span>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </output>
  );
};

export default YosemiteLoader;
