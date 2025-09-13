import React, { useState } from "react";

import Link from "next/link";
import Image from "next/image";

import { IoNotifications } from "react-icons/io5";
import { RiAccountBoxFill } from "react-icons/ri";
import { FaSignInAlt } from "react-icons/fa";
import { AnimatePresence, motion } from "framer-motion";

const UnverifiedProfile = ({ handleLogout }: any) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="UserInfoHeader">
      <div className="Notify">
        <IoNotifications />
        <div className="count"></div>
      </div>
      <div className="HeaderProfDiv">
        <ul className="NavUL">
          <li className="nav-item dropdown">
            <span
              className="nav-profile"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <div className="user">
                <Image src={"https://d2il6osz49gpup.cloudfront.net/Logo.png"} alt="Profile" width={40} height={40} />
              </div>
            </span>
            <AnimatePresence>
              {menuOpen && (
                <motion.div className="profileUl unverified-profile-mobile">
                  <div className="ProfDiv">
                    <Link href="#">
                      <RiAccountBoxFill /> Change Password
                    </Link>
                    <Link href="#" onClick={() => handleLogout()}>
                      <FaSignInAlt /> Sign Out
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="profileUl unverified-profile-desktop">
              <div className="ProfDiv">
                <Link href="#">
                  <RiAccountBoxFill /> Change Password
                </Link>
                <Link href="#" onClick={() => handleLogout()}>
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

export default UnverifiedProfile;
