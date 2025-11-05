"use client";
import React from "react";
import Image from "next/image";
import { FaClock } from "react-icons/fa6";
import { Primary } from "../Buttons";

import "./DashboardProfile.css";

const DashboardProfile = () => {
  return (
    <div className="dashboard-profile-container">
      <div className="dashboard-profile-text">Welcome</div>
      <div className="dashboard-profile">
        <Image
          src={"https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"}
          alt="logo"
          height={40}
          width={40}
        />
        <div className="dashboard-profile-heading">Sky Blue</div>
      </div>
      <div className="dashboard-profile-text">
        Your central hub for insights, performance tracking and quick access to
        essential tools
      </div>
      <div className="dashboard-status">
        <div className="dashboard-verify">
          <FaClock color="#F68523" size={20} />
          <span>Verification in progress — Limited access enabled</span>
        </div>
        <div className="dashboard-verify-mobile">
          <FaClock color="#F68523" size={20} />
          <span>Verification in progress</span>
        </div>
        <Primary text="Book onboarding call" href="/book-demo" />
      </div>
      <div className="dashboard-profile-note">
        <span>Note : </span>This short chat helps us confirm your business and
        add you to our trusted network of verified pet professionals - so you
        can start connecting with clients faster.
      </div>
    </div>
  );
};

export default DashboardProfile;
