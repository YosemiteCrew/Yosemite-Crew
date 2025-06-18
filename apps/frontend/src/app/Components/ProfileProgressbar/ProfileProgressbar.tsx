import React from 'react';
import './ProfileProgressbar.css'; // if you have styles
import Image from 'next/image';
import { Button } from 'react-bootstrap';

interface ProfileProgressbarProps {
  blname: string;
  spname: string;
  progres?: number; // optional
}

const ProfileProgressbar: React.FC<ProfileProgressbarProps> = ({
  blname,
  spname,
  progres = 0, // default if not passed
}) => {
  return (
    <div className="profProgressDiv">
      <div className="Prof">
        <div className="profileText">
          <h4>
            {blname} <span>{spname}</span>
          </h4>
        </div>
        <div className="ProgDiv">
          <div className="progress-bar">
            <span className="progress-fill" style={{ width: `${progres}%` }}></span>
          </div>
          <p className="progress-text">
            {progres}% <span>Complete</span>
          </p>
        </div>
      </div>
      <div className="Profcomp">
        <Button className="complete-button">
          <Image aria-hidden  src="/Images/eyes.png" alt="Complete Later" width={24} height={24}/>
          Complete Later
        </Button>
      </div>
    </div>
  );
};

export default ProfileProgressbar;
