"use client";
import React, { useState } from "react";
import { Button, Col, Form, Row } from "react-bootstrap";
import Link from "next/link";
import { GoCheckCircleFill } from "react-icons/go";
import { Icon } from "@iconify/react/dist/iconify.js";

import { useErrorTost } from "@/app/components/Toast/Toast";
import { useAuthStore } from "@/app/stores/authStore";
import OtpModal from "@/app/components/OtpModal/OtpModal";

import FormInputPass from "@/app/components/Inputs/FormInputPass/FormInputPass";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";

import "./SignUp.css";

const SignUp = () => {
  const { showErrorTost, ErrorTostPopup } = useErrorTost();
  const { signUp } = useAuthStore();

  const [selectedType, setSelectedType] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [subscribe, setSubscribe] = useState(false);

  const [showVerifyModal, setShowVerifyModal] = useState(false);

  const [inputErrors, setInputErrors] = useState<{
    confirmPError?: string;
    email?: string;
    pError?: string;
    selectedType?: string;
    subscribe?: string;
    agree?: string;
  }>({});

  const businessTypes = [
    { key: "veterinaryBusiness", value: "Veterinary Business" },
    { key: "breedingFacility", value: "Breeding Facility" },
    { key: "petSitter", value: "Pet Sitter" },
    { key: "groomerShop", value: "Groomer Shop" },
  ];

  const handleSelectType = (type: React.SetStateAction<string>) => {
    setSelectedType(type);
  };

  const validateSignUpInputs = (
    email: string,
    password: string,
    confirmPassword: string,
    selectedType: string,
    subscribe: boolean,
    agree: boolean
  ) => {
    const errors: {
      email?: string;
      pError?: string;
      confirmPError?: string;
      selectedType?: string;
      subscribe?: string;
      agree?: string;
    } = {};

    if (!email) errors.email = "Email is required";
    if (password) {
      const strongPasswordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!strongPasswordRegex.test(password)) {
        errors.pError =
          "Password must be at least 8 characters long, include uppercase, lowercase, number, and special character";
      }
    } else {
      errors.pError = "Password is required";
    }
    if (!confirmPassword) errors.confirmPError = "Confirm Password is required";
    if (password && confirmPassword && password !== confirmPassword)
      errors.confirmPError = "Passwords do not match";
    if (!selectedType) errors.selectedType = "Please select your business type";
    if (!subscribe)
      errors.subscribe =
        "Please check the Newsletter and Promotional emails box";
    if (!agree) errors.agree = "Please check the Terms and Conditions box";

    return errors;
  };

  const handleSignUp = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const errors = validateSignUpInputs(
      email,
      password,
      confirmPassword,
      selectedType,
      subscribe,
      agree
    );

    setInputErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      const result = await signUp(email, password, selectedType);

      if (result) {
        if (globalThis.window) {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        setShowVerifyModal(true);
      }
    } catch (error: any) {
      if (globalThis.window) {
        window.scrollTo({ top: 0, behavior: "smooth" });
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
    }
  };

  return (
    <section className="MainSignUpSec">
      <Row className="MainSignUpRow">
        <Col md={6} className="MainSignCol">
          <div className="BuildEveryone">
            <div className="SignBuildText">
              <h2>Built for everyone, from day one</h2>
            </div>

            <div className="BuildCloud">
              <div className="CloudItems">
                <div className="CloudIcon">
                  <span>
                    <GoCheckCircleFill />
                  </span>
                </div>
                <div className="CloudText">
                  <h4>Enjoy cloud hosting with us!</h4>
                  <p>
                    Website are hosted on a network of servers, offering
                    greater, scalability, reliability, and flexibility.
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
                  <h4>Start free. Pay as you grow.</h4>
                  <p>
                    Enjoy generous free usage on cloud hosting. Upgrade only
                    when you need more power.
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
                  <h4>GDPR-ready, EU-based servers.</h4>
                  <p>
                    All cloud data is securely hosted in the EU with full GDPR
                    compliance.
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
                  <h2>Sign up for cloud</h2>
                </div>

                <div className="SignFormItems">
                  <FormInput
                    intype="email"
                    inname="email"
                    value={email}
                    inlabel="Enter email address"
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
                <div className="business-type-container">
                  <p>Select your business type</p>
                  <div className="button-group">
                    <ul>
                      {businessTypes.map(({ key, value }) => (
                        <button
                          key={key}
                          type="button"
                          className={`business-button ${selectedType === key ? "selected" : ""}`}
                          onClick={() => handleSelectType(key)}
                        >
                          {value}
                        </button>
                      ))}
                    </ul>
                    {/* Show error for business type */}
                    {inputErrors.selectedType && (
                      <div className="Errors">
                        <Icon icon="mdi:error" width="16" height="16" />
                        {inputErrors.selectedType}
                      </div>
                    )}
                  </div>
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
                  label="Sign me up for newsletter and promotional emails"
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
                <MainBtn
                  btnicon={<GoCheckCircleFill />}
                  btnname="Sign up"
                  iconPosition="left"
                  onClick={handleSignUp}
                />
                {/* <MainBtn btnname="Sign up" btnicon={<GoCheckCircleFill />} iconPosition="left" /> */}
                <h6>
                  {" "}
                  Already have an account? <Link href="/signin">Sign In</Link>
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

// MainBtnProps started
type MainBtnProps = {
  btnname: string;
  btnicon?: React.ReactNode;
  iconPosition?: "left" | "right";
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
};
const MainBtn = ({
  btnname,
  btnicon,
  iconPosition,
  onClick,
}: Readonly<MainBtnProps>) => {
  return (
    <Button className="BlackButton" type="submit" onClick={onClick}>
      {iconPosition === "left" && btnicon && <span>{btnicon}</span>}
      <span className="mx-1">{btnname}</span>
      {iconPosition === "right" && btnicon && <span>{btnicon}</span>}
    </Button>
  );
};
// MainBtnProps Ended

export { MainBtn };
