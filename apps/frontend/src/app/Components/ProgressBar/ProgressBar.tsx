import React from "react";

type ProgressBarProps = {
  progress: number;
};

const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  return (
    <div className="ProgressBarDiv">
      <progress className="progress-bar" value={progress} max={100}>
        {progress}%
      </progress>
      <span className="sr-only">{progress}% Complete</span>
    </div>
  );
};

export default ProgressBar;
