"use client";
import React, { useEffect } from "react";
import OrgGuard from "@/app/components/OrgGuard";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import Cal, { getCalApi } from "@calcom/embed-react";

const BookOnboarding = () => {
  useEffect(() => {
    (async function () {
      const cal = await getCalApi({ namespace: "30min" });
      cal("ui", { hideEventTypeDetails: false, layout: "month_view" });
    })();
  }, []);

  return (
    <div className="flex flex-col gap-8 lg:gap-20 px-4! py-6! md:px-12! md:py-10! lg:px-10! lg:pb-20! lg:pr-20!">
      <div className="flex justify-between items-center w-full">
        <div className="font-grotesk font-medium text-black-text text-[33px]">
          Book onboarding call
        </div>
      </div>
      <Cal
        namespace="30min"
        calLink="yosemitecrew/demo"
        style={{ width: "100%", height: "100%", overflow: "scroll" }}
        config={{ theme: "light", layout: "month_view" }}
      />
    </div>
  );
};

const ProtectedBookOnboarding = () => {
  return (
    <ProtectedRoute>
      <OrgGuard>
        <BookOnboarding />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedBookOnboarding;
