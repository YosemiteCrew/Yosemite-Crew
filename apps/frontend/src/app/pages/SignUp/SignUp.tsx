"use client";
import React, { useEffect, useState } from "react";
import { Col, Form, Row } from "react-bootstrap";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GoCheckCircleFill } from "react-icons/go";
import { Icon } from "@iconify/react/dist/iconify.js";

import { useErrorTost } from "@/app/components/Toast/Toast";
import { useAuthStore } from "@/app/stores/authStore";
import OtpModal from "@/app/components/OtpModal/OtpModal";

import FormInputPass from "@/app/components/Inputs/FormInputPass/FormInputPass";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { Primary } from "@/app/components/Buttons";

import "./SignUp.css";

type SignUpProps = {
  postAuthRedirect?: string;
  signinHref?: string;
  allowNext?: boolean;
  isDeveloper?: boolean;
};

const SignUp = ({
  postAuthRedirect = "/create-org",
  signinHref = "/signin",
  allowNext = true,
  isDeveloper = false,
}: Readonly<SignUpProps>) => {
  const { showErrorTost, ErrorTostPopup } = useErrorTost();
  const { signUp, user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = allowNext ? searchParams.get("next") : null;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [subscribe, setSubscribe] = useState(false);

  const [showVerifyModal, setShowVerifyModal] = useState(false);

  const [inputErrors, setInputErrors] = useState<{
    confirmPError?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    pError?: string;
    subscribe?: string;
    agree?: string;
  }>({});

  useEffect(() => {
    if (user) {
      if (typeof globalThis !== "undefined") {
        globalThis.sessionStorage?.setItem(
          "devAuth",
          isDeveloper ? "true" : "false"
        );
      }
      router.push(next || postAuthRedirect);
    }
  }, [user, router, next, postAuthRedirect, isDeveloper]);

  const passwordErrors = (
    password: string,
    confirmPassword: string
  ): { pError?: string; confirmPError?: string } => {
    const strongPasswordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!password) {
      return {
        pError: "Password is required",
        ...(confirmPassword
          ? {}
          : { confirmPError: "Confirm Password is required" }),
      };
    }

    if (!strongPasswordRegex.test(password)) {
      return {
        pError:
          "Password must be at least 8 characters long, include uppercase, lowercase, number, and special character",
      };
    }

    if (!confirmPassword) {
      return { confirmPError: "Confirm Password is required" };
    }

    if (password !== confirmPassword) {
      return { confirmPError: "Passwords do not match" };
    }

    return {};
  };

  const validateSignUpInputs = (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    confirmPassword: string,
    subscribe: boolean,
    agree: boolean
  ) => {
    const errors: {
      firstName?: string;
      lastName?: string;
      email?: string;
      pError?: string;
      confirmPError?: string;
      subscribe?: string;
      agree?: string;
    } = {};

    if (!firstName) errors.firstName = "First name is required";
    if (!lastName) errors.lastName = "Last name is required";
    if (!email) errors.email = "Email is required";

    Object.assign(errors, passwordErrors(password, confirmPassword));

    if (!subscribe) {
      errors.subscribe =
        "Please check the Newsletter and Promotional emails box";
    }

    if (!agree) {
      errors.agree = "Please check the Terms and Conditions box";
    }

    return errors;
  };

  const handleSignupSuccess = () => {
    if (typeof globalThis !== "undefined") {
      globalThis.window?.scrollTo({ top: 0, behavior: "smooth" });
      // Temporary fallback until custom:role is available in the pool
      globalThis.sessionStorage?.setItem(
        "devAuth",
        isDeveloper ? "true" : "false"
      );
    }
    setShowVerifyModal(true);
  };

  const handleSignupError = (error: any) => {
    if (typeof globalThis !== "undefined") {
      globalThis.window?.scrollTo({ top: 0, behavior: "smooth" });
    }
    const status = error.code === "UsernameExistsException" ? 409 : undefined;
    const message = error.message || "Something went wrong.";

    showErrorTost({
      message,
      errortext: status === 409 ? "Already Registered" : "Signup Error",
      iconElement: (
        <Icon icon="mdi:error" width="20" height="20" color="#EA3729" />
      ),
      className: status === 409 ? "errofoundbg" : "oppsbg",
    });
    setShowVerifyModal(false);
  };

  const handleSignUp = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const errors = validateSignUpInputs(
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      subscribe,
      agree
    );

    setInputErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      const args: Parameters<typeof signUp> = isDeveloper
        ? [email, password, firstName, lastName, "developer"]
        : [email, password, firstName, lastName];

      const result = await signUp(...args);

      if (result) {
        handleSignupSuccess();
      }
    } catch (error: any) {
      handleSignupError(error);
    }
  };

  return (
    <section
      className="MainSignUpSec"
      style={
        isDeveloper
          ? {
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.55), rgba(255,255,255,0.55)), url("/assets/bgDev.jpg")',
            }
          : undefined
      }
    >
      <Row className="MainSignUpRow">
        <Col md={6} className="MainSignCol">
          <div className="BuildEveryone">
            <div className="SignBuildText">
              <h2>
                {isDeveloper
                  ? "Build, test, and ship apps on Yosemite Crew"
                  : "Built for everyone, from day one"}
              </h2>
            </div>

            <div className="BuildCloud">
              <div className="CloudItems">
                <div className="CloudIcon">
                  <span>
                    <GoCheckCircleFill />
                  </span>
                </div>
                <div className="CloudText">
                  <h4>
                    {isDeveloper
                      ? "API-first, self-host or managed"
                      : "Enjoy smooth online solutions with us!"}
                  </h4>
                  <p>
                    {isDeveloper
                      ? "Open source core with APIs built for integrations. Run it yourself or use our managed stack."
                      : "Our services are built on a strong foundation for great performance and flexibility."}
                  </p>
                </div>
              </div>

              <div className="CloudItems">
                <div className="CloudIcon">
                  <span>
                    <GoCheckCircleFill />
                  </span>
                </div>
                <div className="CloudText">
                  <h4>
                    {isDeveloper
                      ? "Local dev + production ready"
                      : "Start free and upgrade as needed."}
                  </h4>
                  <p>
                    {isDeveloper
                      ? "Develop locally against the same APIs you deploy. No lock-in between self-hosted and hosted."
                      : "Enjoy generous free usage. Upgrade only when you need."}
                  </p>
                </div>
              </div>

              <div className="CloudItems">
                <div className="CloudIcon">
                  <span>
                    <GoCheckCircleFill />
                  </span>
                </div>
                <div className="CloudText">
                  <h4>
                    {isDeveloper
                      ? "Secure by default"
                      : "Our servers are EU-based and GDPR compliant."}
                  </h4>
                  <p>
                    {isDeveloper
                      ? "Encrypted storage, audit-friendly logs, and least-privilege access for integrations whether self-hosted or managed."
                      : "All data is securely stored in the EU, fully GDPR compliant."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Col>

        <Col md={6} className="MainSignCol">
          <div className="SignUpFormDiv">
            <Form onSubmit={handleSignUp} method="post">
              <div className="TopSignUp">
                <div className="Headingtext">
                  <h2>
                    {isDeveloper ? "Sign up for developer access" : "Sign up"}
                  </h2>
                </div>

                <div className="SignFormItems">
                  <FormInput
                    intype="text"
                    inname="first name"
                    value={firstName}
                    inlabel="First name"
                    onChange={(e) => setFirstName(e.target.value)}
                    error={inputErrors.firstName}
                  />
                  <FormInput
                    intype="text"
                    inname="last name"
                    value={lastName}
                    inlabel="Last name"
                    onChange={(e) => setLastName(e.target.value)}
                    error={inputErrors.lastName}
                  />
                  <FormInput
                    intype="email"
                    inname="email"
                    value={email}
                    inlabel="Enter email"
                    onChange={(e) => setEmail(e.target.value)}
                    error={inputErrors.email}
                  />
                  <FormInputPass
                    intype="password"
                    inname="password"
                    value={password}
                    inlabel="Set up password"
                    onChange={(e) => setPassword(e.target.value)}
                    error={inputErrors.pError}
                  />
                  <FormInputPass
                    intype="password"
                    inname="password"
                    value={confirmPassword}
                    inlabel="Confirm password"
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    error={inputErrors.confirmPError}
                  />
                </div>
              </div>

              <div className="Sign_check">
                <Form.Check
                  type="checkbox"
                  label={
                    <>
                      I agree to Yosemite Crew’s{" "}
                      <Link className="policylink" href="/terms-and-conditions">
                        terms and conditions
                      </Link>{" "}
                      and{" "}
                      <Link className="policylink" href="/privacy-policy">
                        privacy policy
                      </Link>
                    </>
                  }
                  onChange={(e) => setAgree(e.target.checked)}
                />
                {/* Show error for terms */}
                {inputErrors.agree && (
                  <div className="Errors">
                    <Icon icon="mdi:error" width="16" height="16" />
                    {inputErrors.agree}
                  </div>
                )}
                <Form.Check
                  type="checkbox"
                  label={<>Sign me up for newsletter and promotional emails</>}
                  onChange={(e) => setSubscribe(e.target.checked)}
                />
                {/* Show error for newsletter */}
                {inputErrors.subscribe && (
                  <div className="Errors">
                    <Icon icon="mdi:error" width="16" height="16" />
                    {inputErrors.subscribe}
                  </div>
                )}
              </div>

              <div className="Signbtn">
                <Primary
                  text="Sign up"
                  onClick={handleSignUp}
                  href="#"
                  style={{ width: "100%" }}
                />
                <h6>
                  {" "}
                  Already have an account?{" "}
                  <Link href={signinHref}>Sign In</Link>
                </h6>
              </div>
            </Form>
          </div>
        </Col>
      </Row>
      <OtpModal
        email={email}
        password={password}
        showErrorTost={showErrorTost}
        showVerifyModal={showVerifyModal}
        setShowVerifyModal={setShowVerifyModal}
      />
      {ErrorTostPopup}
    </section>
  );
};

export default SignUp;
