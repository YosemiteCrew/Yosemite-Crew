import React from 'react';
import PropTypes from 'prop-types';

const BoxPractComponent = ({ Bpimg, BpTxt1, BpTxt2, BpPara }) => {
  return (
    <div className="PracBox">
      <img src={Bpimg} alt="" />
      <h4>
        {BpTxt1} <br /> {BpTxt2}
      </h4>
      <p>{BpPara}</p>
    </div>
  );
};

BoxPractComponent.propTypes = {
  Bpimg: PropTypes.string.isRequired,
  BpTxt1: PropTypes.string.isRequired,
  BpTxt2: PropTypes.string.isRequired,
  BpPara: PropTypes.string.isRequired,
};

export default BoxPractComponent;