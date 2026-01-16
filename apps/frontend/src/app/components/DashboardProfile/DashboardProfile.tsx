"use client";
import React from "react";
import Image from "next/image";
import { FaClock } from "react-icons/fa6";

import { Primary } from "../Buttons";
import { usePrimaryOrg } from "@/app/hooks/useOrgSelectors";
import { useAuthStore } from "@/app/stores/authStore";
import { isHttpsImageUrl } from "@/app/utils/urls";
import { usePrimaryOrgProfile } from "@/app/hooks/useProfiles";

const DashboardProfile = () => {
  const profile = usePrimaryOrgProfile();
  const primaryOrg = usePrimaryOrg();
  const attributes = useAuthStore((s) => s.attributes);

  if (!primaryOrg) return null;

  return (
    <div className="flex flex-col items-start w-full gap-2">
      <div className="text-bpdy-4 text-text-tertiary">Welcome</div>
      <div className="flex items-center gap-2">
        <Image
          src={
            isHttpsImageUrl(profile?.personalDetails?.profilePictureUrl)
              ? profile?.personalDetails?.profilePictureUrl
              : "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"
          }
          alt="logo"
          height={40}
          width={40}
          className="rounded-full object-cover h-10 min-w-10 max-h-10"
        />
        <div className="text-heading-1 text-text-primary">
          {(attributes?.given_name || "") +
            " " +
            (attributes?.family_name || "")}
        </div>
      </div>
      <div className="text-bpdy-4-emphasis text-text-tertiary">
        Your central hub for insights, performance tracking and quick access to
        essential tools
      </div>
      <div className="flex items-center justify-between gap-2 w-full flex-wrap">
        {!primaryOrg.isVerified && (
          <>
            <div className="px-6 py-[12px] bg-card-warning rounded-2xl flex items-center justify-center gap-2">
              <FaClock color="#F68523" size={16} />
              <span className="text-body-4-emphasis text-pending-text">Verification in progress — Limited access enabled</span>
            </div>
            <Primary text="Book onboarding call" href="/book-onboarding" />
          </>
        )}
      </div>
      {!primaryOrg.isVerified && (
        <div className="text-caption-1 text-text-primary w-full sm:max-w-[500px]">
          <span className="text-text-brand">Note : </span>This short chat helps
          us confirm your business and add you to our trusted network of
          verified pet professionals - so you can start connecting with clients
          faster.
        </div>
      )}
    </div>
  );
};

export default DashboardProfile;
