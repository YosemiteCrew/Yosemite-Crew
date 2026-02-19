"use client";
import React, { useEffect } from "react";
import OrgGuard from "@/app/ui/layout/guards/OrgGuard";
import ProtectedRoute from "@/app/ui/layout/guards/ProtectedRoute";
import Cal, { getCalApi } from "@calcom/embed-react";

const BookOnboarding = () => {
  useEffect(() => {
    (async function () {
      const cal = await getCalApi({ namespace: "30min" });
      cal("ui", { hideEventTypeDetails: false, layout: "month_view" });
    })();
  }, []);

  return (
    <div className="flex flex-col gap-6 px-4! py-6! md:px-12! md:py-10! lg:px-10! lg:pb-20! lg:pr-20!">
      <Cal
        namespace="30min"
        calLink="yosemitecrew/onboarding"
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
