"use client";
import React from "react";
import Image from "next/image";
import { FaClock } from "react-icons/fa6";
import { Primary, Secondary } from "../Buttons";
import { usePrimaryOrg } from "@/app/hooks/useOrgSelectors";
import { useAuthStore } from "@/app/stores/authStore";

import "./DashboardProfile.css";

const DashboardProfile = () => {
  const primaryOrg = usePrimaryOrg();
  const attributes = useAuthStore((s) => s.attributes);

  if (!primaryOrg) return null;

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
        <div className="dashboard-profile-heading">
          {(attributes?.given_name || "") +
            " " +
            (attributes?.family_name || "")}
        </div>
      </div>
      <div className="dashboard-profile-text">
        Your central hub for insights, performance tracking and quick access to
        essential tools
      </div>
      <div className="dashboard-status">
        {primaryOrg.isVerified ? (
          <div className="flex flex-col gap-3 w-full border border-grey-light px-4 py-3 rounded-2xl">
            <div className="dashboard-status">
              <div className="font-grotesk font-medium text-black-text text-[23px]">
                Setup stripe payment
              </div>
              <Secondary text="Setup stripe" href="/setup-stripe" className="w-[200px]!" />
            </div>
            <div className="dashboard-status">
              <div className="font-grotesk font-medium text-black-text text-[23px]">
                Add specialities & services
              </div>
              <Secondary text="Add services" href="/orgnanization" className="w-[200px]!" />
            </div>
            <div className="dashboard-status">
              <div className="font-grotesk font-medium text-black-text text-[23px]">
                Invite team members
              </div>
              <Secondary text="Invite team" href="/orgnanization" className="w-[200px]!" />
            </div>
          </div>
        ) : (
          <>
            <div className="dashboard-verify">
              <FaClock color="#F68523" size={20} />
              <span>Verification in progress — Limited access enabled</span>
            </div>
            <div className="dashboard-verify-mobile">
              <FaClock color="#F68523" size={20} />
              <span>Verification in progress</span>
            </div>
            <Primary text="Book onboarding call" href="/book-demo" />
          </>
        )}
      </div>
      {primaryOrg.isVerified ? (
        <div className="dashboard-profile-note">
          <span>Note : </span>Stripe is needed to receive payments from your
          users.
        </div>
      ) : (
        <div className="dashboard-profile-note">
          <span>Note : </span>This short chat helps us confirm your business and
          add you to our trusted network of verified pet professionals - so you
          can start connecting with clients faster.
        </div>
      )}
    </div>
  );
};

export default DashboardProfile;
