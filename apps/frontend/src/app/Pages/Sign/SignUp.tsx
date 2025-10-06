"use client";
import React, { useState } from "react";
import { Button, Col, Container, Form, Row } from "react-bootstrap";
import Image from "next/image";
import Link from "next/link";
import { GoCheckCircleFill } from "react-icons/go";
import { Icon } from "@iconify/react/dist/iconify.js";

import { useErrorTost } from "@/app/components/Toast";
import { useAuthStore } from "@/app/stores/authStore";
import OtpModal from "@/app/components/OtpModal/OtpModal";

import "./Sign.css";

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
    confirmPassword?: string;
    email?: string;
    password?: string;
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

  const handleSignUp = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const errors: {
      email?: string;
      password?: string;
      confirmPassword?: string;
      selectedType?: string;
      subscribe?: string;
      agree?: string;
    } = {};
    if (!email) errors.email = "Email is required";
    if (!password) {
      errors.password = "Password is required";
    } else {
      // Regex for strong password
      const strongPasswordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

      if (!strongPasswordRegex.test(password)) {
        errors.password =
          "Password must be at least 8 characters long, include uppercase, lowercase, number, and special character";
      }
    }
    if (!confirmPassword)
      errors.confirmPassword = "Confirm Password is required";
    if (!selectedType) errors.selectedType = "Please select your business type";
    if (!subscribe)
      errors.subscribe =
        "Please check the Newsletter and Promotional emails box";
    if (!agree) errors.agree = "Please check the Terms and Conditions box";
    if (password !== confirmPassword)
      errors.confirmPassword = "Passwords do not match";

    // Remove selectedType before setting input errors (if you don't want to show it in input fields)
    setInputErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    // Always validate passwords
    if (password !== confirmPassword) {
      showErrorTost({
        message: "Password and Confirm Password do not match.",
        errortext: "Password Mismatch",
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
      const result = await signUp(email, password, selectedType);

      if (result) {
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        setShowVerifyModal(true);
      }
    } catch (error: any) {
      if (typeof window !== "undefined") {
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
      <Container>
        <Row>
          <Col md={6}>
            <div className="BuildEveryone">
              <div className="SignBuildText">
                <h2>Built for Everyone, from Day One.</h2>
              </div>

              <div className="BuildCloud">
                <div className="CloudItems">
                  <div className="CloudIcon">
                    <span>
                      <GoCheckCircleFill />
                    </span>
                  </div>
                  <div className="CloudText">
                    <h4>Enjoy Cloud Hosting with us!</h4>
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
                    <h4>Start Free. Pay as You Grow.</h4>
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
                    <h4>GDPR-Ready, EU-Based Servers.</h4>
                    <p>
                      All cloud data is securely hosted in the EU with full GDPR
                      compliance.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Col>

          <Col md={6}>
            <div className="SignUpFormDiv">
              <Form onSubmit={handleSignUp} method="post">
                <div className="TopSignUp">
                  <div className="Headingtext">
                    <h2>Sign up for Cloud </h2>
                  </div>

                  <div className="SignFormItems">
                    <FormInput
                      intype="email"
                      inname="email"
                      value={email}
                      inlabel="Enter Email Address"
                      onChange={(e) => setEmail(e.target.value)}
                      error={inputErrors.email}
                    />
                    <FormInputPass
                      intype="password"
                      inname="password"
                      value={password}
                      inlabel="Set up Password"
                      onChange={(e) => setPassword(e.target.value)}
                      error={inputErrors.password}
                    />
                    <FormInputPass
                      intype="password"
                      inname="password"
                      value={confirmPassword}
                      inlabel="Confirm Password"
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      error={inputErrors.confirmPassword}
                    />
                  </div>
                  <div className="business-type-container">
                    <p>Select Your Business Type</p>
                    <div className="button-group">
                      <ul>
                        {businessTypes.map(({ key, value }) => (
                          <li
                            key={key}
                            className={`business-button ${selectedType === key ? "selected" : ""}`}
                            onClick={() => handleSelectType(key)}
                          >
                            {value}
                          </li>
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
                        <Link
                          className="policylink"
                          href="/terms-and-conditions"
                        >
                          Terms and Conditions
                        </Link>{" "}
                        and{" "}
                        <Link className="policylink" href="/privacy-policy">
                          Privacy Policy
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
                    label="Sign me up for Newsletter and Promotional emails"
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
                    Already have an account? <Link href="/signin">Login</Link>
                  </h6>
                </div>
              </Form>
            </div>
          </Col>
        </Row>
      </Container>
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
export function MainBtn({
  btnname,
  btnicon,
  iconPosition,
  onClick,
}: Readonly<MainBtnProps>) {
  return (
    <Button className="BlackButton" type="submit" onClick={onClick}>
      {iconPosition === "left" && btnicon && <span>{btnicon}</span>}
      <span className="mx-1">{btnname}</span>
      {iconPosition === "right" && btnicon && <span>{btnicon}</span>}
    </Button>
  );
}
// MainBtnProps Ended

// FormInputProps started
type FormInputProps = {
  intype: string;
  inname?: string;
  value: string;
  inlabel: string;
  readonly?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
};
export function FormInput({
  intype,
  inname,
  inlabel,
  value,
  onChange,
  onBlur,
  readonly,
  error,
}: Readonly<FormInputProps>) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="w-100">
      <div
        className={`SignInput floating-input ${isFocused || value ? "focused" : ""}`}
      >
        <input
          type={intype}
          name={inname}
          id={inname}
          value={value ?? ""}
          onChange={onChange}
          autoComplete="off"
          readOnly={readonly}
          required
          placeholder=" "
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={error ? "is-invalid" : ""}
        />
        <label htmlFor={inname}>{inlabel}</label>
      </div>
      {/* Show error as bottom red text only for input validation */}
      {error && (
        <div className="Errors">
          <Icon icon="mdi:error" width="16" height="16" />
          {error}
        </div>
      )}
    </div>
  );
}
// FormInputProps Ended

// FormInputPassProps started
type FormInputPassProps = {
  intype: string;
  inname: string;
  value: string;
  inlabel: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inPlaceHolder?: string;
};
export function FormInputPass({
  intype,
  inname,
  inlabel,
  value,
  onChange,
  error,
  inPlaceHolder,
}: FormInputPassProps & { error?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="w-100">
      <div
        className={`SignPassInput floating-input ${isFocused || value ? "focused" : ""}`}
      >
        <input
          type={showPassword ? "text" : intype}
          name={inname}
          id={inname}
          value={value ?? ""}
          autoComplete="new-password"
          onChange={onChange}
          required
          placeholder={isFocused ? inPlaceHolder : ""}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={error ? "is-invalid" : ""}
        />
        <label htmlFor={inname}>{inlabel}</label>
        <Button type="button" onClick={togglePasswordVisibility} tabIndex={-1}>
          <Image
            aria-hidden
            src="https://d2il6osz49gpup.cloudfront.net/Images/eyes.png"
            alt="eyes"
            width={24}
            height={24}
          />
        </Button>
      </div>

      {/* Show error as bottom red text only for input validation */}
      {error && (
        <div className="Errors">
          <Icon icon="mdi:error" width="16" height="16" />
          {error}
        </div>
      )}
    </div>
  );
}
// FormInputPassProps Ended
