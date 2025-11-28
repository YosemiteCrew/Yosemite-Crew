import React from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";

const StripeOnboarding = () => {
  return (
    <div className="flex flex-col gap-8 lg:gap-20 px-4! py-6! md:px-12! md:py-10! lg:px-10! lg:pb-20! lg:pr-20!">
      <div className="flex justify-between items-center w-full">
        <div className="font-grotesk font-medium text-black-text text-[33px]">
          Stripe oboarding
        </div>
      </div>
    </div>
  );
};

const ProtectedStripeOnboarding = () => {
  return (
    <ProtectedRoute>
      <StripeOnboarding />
    </ProtectedRoute>
  );
};

export default ProtectedStripeOnboarding;
