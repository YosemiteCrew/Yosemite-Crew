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
    <div
      className={`yosemite-loader ${isFullscreen ? "yosemite-loader--fullscreen" : "yosemite-loader--inline"}`}
      role="status"
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
    </div>
  );
};

export default YosemiteLoader;
