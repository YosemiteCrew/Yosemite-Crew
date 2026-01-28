/* eslint-disable @next/next/no-img-element */
import React from "react";
import "./YosemiteLoader.css";

type LoaderVariant = "inline" | "fullscreen";

type YosemiteLoaderProps = {
  variant?: LoaderVariant;
  label?: string;
  size?: number;
  testId?: string;
};

const YosemiteLoader: React.FC<YosemiteLoaderProps> = ({
  variant = "inline",
  label,
  size = 80,
  testId,
}) => {
  const isFullscreen = variant === "fullscreen";

  return (
    <output
      className={`yosemite-loader ${isFullscreen ? "yosemite-loader--fullscreen" : "yosemite-loader--inline"}`}
      aria-live="polite"
      data-testid={testId}
    >
      <img
        src="/assets/yosemiteLoader.gif"
        alt="Loading"
        width={size}
        height={size}
        className="yosemite-loader__image"
      />
      {label ? <span className="yosemite-loader__label">{label}</span> : null}
    </output>
  );
};

export default YosemiteLoader;
