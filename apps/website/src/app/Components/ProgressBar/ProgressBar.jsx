
import React from "react";
import PropTypes from "prop-types";
import "./ProgressBar.css"

const ProgressBar = ({ progress }) => {
  return (


    <div className="ProgressBarDiv">
        <div className="progress-bar" role="progressbar"aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} style={{ width: `${progress}%` }} ></div>
        <span className="sr-only">{progress}% Complete</span>
    </div>
  
  );
};

// PropTypes validation
ProgressBar.propTypes = {
  progress: PropTypes.number.isRequired, // progress must be a number and is required
};

export default ProgressBar;
