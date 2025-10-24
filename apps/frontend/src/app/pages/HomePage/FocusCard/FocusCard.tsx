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
      <Image aria-hidden src={Focimg} alt="Hero" width={130} height={130} />
      <div className="focusText">
        <h4>{focname}</h4>
        <p>{focpara}</p>
      </div>
    </div>
  );
};

export default FocusCard