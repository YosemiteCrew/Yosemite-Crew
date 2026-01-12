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
      <Image aria-hidden src={Bpimg} alt="Hero" width={72} height={72} />
      <div className="text-heading-2 text-text-primary pracTitle">
        {BpTxt1} {BpTxt2}
      </div>
      <div className="text-body-4 text-text-secondary pracDesc">{BpPara}</div>
    </div>
  );
};

export default FeatureBox;
