"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { IoIosCloseCircle, IoIosCheckmarkCircle } from "react-icons/io";

import { FillBtn, UnFillBtn } from "@/app/pages/HomePage/HomePage";

import "./Cookies.css";

const Cookies = () => {
  const [showCookiePopup, setShowCookiePopup] = useState(false);

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

  if (!showCookiePopup) return null;

  return (
    <div className="CookieMain">
      <div className="CookieSec">
        <div className="CookieInner">
          <div className="TopCokieInner">
            Yosemite Crew doesn&apos;t use third party cookies Only a single
            in-house cookie.
          </div>
          <div className="BottomCokieInner">
            No data is sent to a third party.
          </div>
        </div>

        <div className="CookieBotm">
          <FillBtn
            icon={<IoIosCheckmarkCircle />}
            text="Accept"
            onClick={handleConsent}
            href="/"
            style={{
              padding: "10px 16px",
              minHeight: "40px",
              fontSize: "16px",
              fontWeight: 500,
            }}
          />
          <UnFillBtn
            icon={<IoIosCloseCircle />}
            text="Decline"
            href="/"
            onClick={handleRejection}
            style={{
              padding: "10px 16px",
              minHeight: "40px",
              fontSize: "16px",
              fontWeight: 500,
            }}
          />
        </div>
      </div>

      <div className="CookieImg">
        <Image
          src="https://d2il6osz49gpup.cloudfront.net/Images/cookie.png"
          alt="aboutstory"
          width={222}
          height={314}
        />
      </div>
      <div className="CookieImg2">
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
