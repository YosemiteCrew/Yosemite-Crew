"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";

import { publicRoutes } from "@/app/utils/const";
import { Primary, Secondary } from "../Buttons";

const Cookies = () => {
  const [showCookiePopup, setShowCookiePopup] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const cookieConsentGiven = localStorage.getItem("cookieConsentGiven");
    if (!cookieConsentGiven) {
      setShowCookiePopup(true); // If not accepted, show popup
    }
  }, []);

  const handleConsent = () => {
    setShowCookiePopup(false);
    localStorage.setItem("cookieConsentGiven", "true"); // Mark as accepted
  };

  const handleRejection = () => {
    setShowCookiePopup(false);
    localStorage.setItem("cookieConsentGiven", "false"); // Mark as rejected
  };

  if (!publicRoutes.has(pathname)) return null;

  if (!showCookiePopup) return null;

  return (
    <div className="fixed left-20 bottom-[130px] z-9999">
      <div className="bg-white rounded-2xl max-w-[300px] p-3 z-22 border border-card-border">
        <div className="flex flex-col gap-2">
          <div className="text-body-4-emphasis text-text-primary">
            Yosemite Crew doesn&apos;t use third party cookies Only a single
            in-house cookie.
          </div>
          <div className="text-caption-1 text-text-primary">
            No data is sent to a third party.
          </div>
        </div>

        <div className="flex flex-col mt-3 mb-[10px] gap-2">
          <Primary text="Accept" href="#" onClick={handleConsent} />
          <Secondary text="Reject" href="#" onClick={handleRejection} />
        </div>
      </div>

      <div className="absolute -bottom-[250px] left-[60px] pointer-events-none z-25">
        <Image
          src="https://d2il6osz49gpup.cloudfront.net/Images/cookie.png"
          alt="aboutstory"
          width={222}
          height={314}
        />
      </div>
      <div className="absolute -bottom-[150px] left-[45px] -z-25">
        <Image
          src="https://d2il6osz49gpup.cloudfront.net/Images/cookie-bg.png"
          alt="aboutstory"
          width={250}
          height={205}
        />
      </div>
    </div>
  );
};

export default Cookies;
