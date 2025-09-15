"use client";
import React, { useState, useRef, useEffect } from "react";
import { Button, Modal } from "react-bootstrap";
import Link from "next/link";

import { Icon } from "@iconify/react/dist/iconify.js";
import { useAuthStore } from "@/app/stores/authStore";

import "./OtpModal.css";

const OtpModal = ({
  email,
  password,
  showErrorTost,
  showVerifyModal,
  setShowVerifyModal,
}: any) => {
  const { confirmSignUp, resendCode, signIn } = useAuthStore();
  const [code, setCode] = useState(Array(6).fill(""));
  const [activeInput, setActiveInput] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [invalidOtp, setInvalidOtp] = useState(false);
  // Stable ref callback to avoid React warning
  const setOtpRef = (el: HTMLInputElement | null, idx: number) => {
    otpRefs.current[idx] = el;
  };

  const [timer, setTimer] = useState(150); // 2.30 minutes in seconds
  const [timerActive, setTimerActive] = useState(false);

  const handleCodeChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    idx: number
  ) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    if (!val) return;
    const newCode = [...code];
    newCode[idx] = val[0];
    setCode(newCode);
    if (idx < 5 && val) {
      otpRefs.current[idx + 1]?.focus();
      setActiveInput(idx + 1);
    }
  };

  const handleCodeKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number
  ) => {
    if (e.key === "Backspace") {
      if (code[idx]) {
        const newCode = [...code];
        newCode[idx] = "";
        setCode(newCode);
      } else if (idx > 0) {
        otpRefs.current[idx - 1]?.focus();
        setActiveInput(idx - 1);
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
      setActiveInput(idx - 1);
    } else if (e.key === "ArrowRight" && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
      setActiveInput(idx + 1);
    }
  };

  const handleVerify = async (): Promise<void> => {
    if (code.includes("")) {
      showErrorTost({
        message: "Please enter the full OTP",
        errortext: "Error",
        iconElement: (
          <Icon
            icon="solar:danger-triangle-bold"
            width="20"
            height="20"
            color="#EA3729"
          />
        ),
        className: "errofoundbg",
      });
      return;
    }

    try {
      const result = await confirmSignUp(email, code.join(""));
      if (result) {
        setCode(Array(6).fill(""));
        setShowVerifyModal(false);
        try {
          await signIn(email, password);
        } catch (error) {
          showErrorTost({
            message: `Sign in failed`,
            errortext: "Error",
            iconElement: (
              <Icon
                icon="solar:danger-triangle-bold"
                width="20"
                height="20"
                color="#EA3729"
              />
            ),
            className: "errofoundbg",
          });
        }
      }
    } catch (error: any) {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      setInvalidOtp(true);
    }
  };

  const handleResend = async (): Promise<void> => {
    try {
      const result = await resendCode(email);
      if (result) {
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        showErrorTost({
          message: "A new verification code has been sent to your email.",
          errortext: "Code Resent",
          iconElement: (
            <Icon
              icon="solar:danger-triangle-bold"
              width="20"
              height="20"
              color="#00C853"
            />
          ),
          className: "CongratsBg",
        });
        setCode(Array(6).fill("")); // Clear OTP fields on resend
        setActiveInput(0); // Focus first input
        setTimer(150);
        setTimerActive(true);
      }
    } catch (error: any) {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      showErrorTost({
        message: error.message || "Error resending code.",
        errortext: "Error",
        iconElement: (
          <Icon
            icon="solar:danger-triangle-bold"
            width="20"
            height="20"
            color="#EA3729"
          />
        ),
        className: "errofoundbg",
      });
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (showVerifyModal && timerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    if (timer === 0 && interval) {
      clearInterval(interval);
      setTimerActive(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showVerifyModal, timerActive, timer]);

  useEffect(() => {
    if (showVerifyModal) {
      setTimer(150);
      setTimerActive(true);
    }
  }, [showVerifyModal]);

  return (
    <Modal
      show={showVerifyModal}
      onHide={() => setShowVerifyModal(false)}
      centered
      contentClassName="VerifyModalSec"
    >
      <Modal.Body>
        <div className="VerifyModalTopInner">
          <div className="VerifyTexted">
            <h2>Verify Email Address</h2>
            <h6>
              A Verification code has been sent to <br /> <span>{email}</span>
            </h6>
            <p>
              Please check your inbox and enter the verification code below to
              verify your email address. The Code will expire soon.
            </p>
          </div>
          <div className="verifyInputDiv">
            <div className="verifyInput" style={{ marginBottom: 24 }}>
              {code.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => setOtpRef(el, idx)}
                  type="text"
                  maxLength={1}
                  value={digit}
                  autoFocus={activeInput === idx}
                  onChange={(e) => handleCodeChange(e, idx)}
                  onKeyDown={(e) => handleCodeKeyDown(e, idx)}
                />
              ))}
            </div>
            {invalidOtp ? (
              <p>
                <Icon icon="solar:danger-circle-bold" width="18" height="18" />{" "}
                Invalid OTP
              </p>
            ) : (
              ""
            )}{" "}
          </div>
        </div>
        <div className="VerifyModalBottomInner">
          <div className="VerifyBtnDiv">
            <Button
              onClick={handleVerify}
              disabled={timer === 0 || code.some((digit) => digit === "")}
            >
              Verify Code
            </Button>
            <span>
              {timer > 0
                ? `${String(Math.floor(timer / 60)).padStart(2, "0")}:${String(timer % 60).padStart(2, "0")} sec`
                : "Code expired"}
            </span>
          </div>
          <div className="VerifyResent">
            <Link
              href=""
              onClick={(e) => {
                e.preventDefault();
                handleResend();
              }}
            >
              <span>Request New Code</span>
            </Link>
            <Link href="#" onClick={() => setShowVerifyModal(false)}>
              . Change Email
            </Link>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default OtpModal;
