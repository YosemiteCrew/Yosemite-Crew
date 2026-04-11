import Image from 'next/image';
import React from 'react'

import './FocusCard.css'

interface FocusCardProps {
  Focimg: string;
  focname: string;
  focpara: string;
}

const FocusCard: React.FC<FocusCardProps> = ({ Focimg, focname, focpara }) => {
  return (
    <div className="FocusItem">
      <Image aria-hidden src={Focimg} alt="Hero" width={110} height={110} />
      <div className="focusText">
        <div className="text-heading-2 text-text-primary focusTitle">{focname}</div>
        <div className="text-body-4 text-text-secondary focusDesc">{focpara}</div>
      </div>
    </div>
  );
};

export default FocusCard
