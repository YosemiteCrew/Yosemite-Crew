import React from "react";
import "./ProgressBar.css";

type ProgressBarProps = {
  progress: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  return (
    <div className="ProgressBarDiv">
      <div
        className="progress-bar"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{ width: `${progress}%` }}
      ></div>
      <span className="sr-only">{progress}% Complete</span>
    </div>
  );
};

export default ProgressBar;
