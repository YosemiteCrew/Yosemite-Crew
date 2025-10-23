import React from "react";
import Image from "next/image";

import "./FeatureBox.css";

interface BoxPractProps {
  Bpimg: string;
  BpTxt1: string;
  BpTxt2: string;
  BpPara: string;
}

const FeatureBox = ({ Bpimg, BpTxt1, BpTxt2, BpPara }: BoxPractProps) => {
  return (
    <div className="PracBox">
      <Image aria-hidden src={Bpimg} alt="Hero" width={82} height={82} />
      <h4>
        {BpTxt1} {" "} {BpTxt2}
      </h4>
      <p>{BpPara}</p>
    </div>
  );
};

export default FeatureBox;
