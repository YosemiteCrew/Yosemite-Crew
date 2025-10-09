import React from "react";

import Link from "next/link";
import Image from "next/image";
import { FaCaretDown, FaUser } from "react-icons/fa6";
import { IoIosHelpCircleOutline } from "react-icons/io";
import { IoNotifications } from "react-icons/io5";
import { RiAccountBoxFill } from "react-icons/ri";
import { FaSignInAlt } from "react-icons/fa";

const VerifiedProfile = ({ handleLogout }: any) => {
  return (
    <div className="UserInfoHeader verified-userinfo">
      <div className="Notify">
        <IoNotifications />
        <div className="count"></div>
      </div>
      <div className="HeaderProfDiv">
        <ul className="NavUL">
          <li className="nav-item dropdown">
            <span className="nav-profile">
              <div className="user">
                <Image
                  src={"https://d2il6osz49gpup.cloudfront.net/Logo.png"}
                  alt="Profile"
                  width={40}
                  height={40}
                />
              </div>
              <div className="userHostDiv">
                <div className="userName">
                  <p>&quot;Test Name&quot;</p>
                  <FaCaretDown />
                </div>
                <p className="Tier">Free tier - Cloud hosted</p>
              </div>
            </span>
            <div className="profileUl verified-profile-desktop">
              <div className="ProfDiv">
                <Link href="/">
                  <FaUser /> My Profile
                </Link>
                <Link href="#">
                  <RiAccountBoxFill /> Account Settings
                </Link>
                <Link href="#">
                  <IoIosHelpCircleOutline /> Need Help?
                </Link>
                <Link href="/" onClick={() => handleLogout()}>
                  <FaSignInAlt /> Sign Out
                </Link>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default VerifiedProfile;
