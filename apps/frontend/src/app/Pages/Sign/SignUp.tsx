"use client";
import React, { useCallback, useState, useRef, useEffect } from "react";
import { Button, Col, Container, Form, Row, Modal } from "react-bootstrap";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CognitoUserPool,
  CognitoUserAttribute,
  CognitoUser,
  ICognitoUserPoolData,
} from "amazon-cognito-identity-js";

import { GoCheckCircleFill } from "react-icons/go";

import { Icon } from "@iconify/react/dist/iconify.js";
import { useErrorTost } from "@/app/Components/Toast";

import "./Sign.css";

const poolData: ICognitoUserPoolData = {
  UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USERPOOLID || "",
  ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENTID || "",
};

const userPool = new CognitoUserPool(poolData);

const SignUp = () => {
  const router = useRouter();
  const { showErrorTost, ErrorTostPopup } = useErrorTost();

  const [selectedType, setSelectedType] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agree, setIagree] = useState(false);
  const [subscribe, setSubscribe] = useState(false);

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [code, setCode] = useState(Array(6).fill(""));
  const [activeInput, setActiveInput] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [invalidOtp, setInvalidOtp] = useState(false);
  // Stable ref callback to avoid React warning
  const setOtpRef = (el: HTMLInputElement | null, idx: number) => {
    otpRefs.current[idx] = el;
  };

  const [inputErrors, setInputErrors] = useState<{
    confirmPassword?: string;
    email?: string;
    password?: string;
    selectedType?: string;
    subscribe?: string;
    agree?: string;
  }>({});
  const [timer, setTimer] = useState(150); // 2.30 minutes in seconds
  const [timerActive, setTimerActive] = useState(false);

  // Timer effect for OTP modal
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

  // Reset timer when modal opens
  useEffect(() => {
    if (showVerifyModal) {
      setTimer(150);
      setTimerActive(true);
    }
  }, [showVerifyModal]);

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
      const userData = {
        Username: email,
        Pool: userPool,
      };

      const cognitoUser = new CognitoUser(userData);
      cognitoUser.confirmRegistration(code.join(""), true, (err, result) => {
        if (err) {
          if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
          setInvalidOtp(true);
          return;
        }
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }

        setCode(Array(6).fill(""));
        setShowVerifyModal(false);

        showErrorTost({
          message: "Verification successful!",
          errortext: "Success",
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
        setTimeout(() => {
          router.push(`/signin`);
        }, 2000);
      });
    } catch (error: any) {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      setInvalidOtp(true);
    }
  };

  const handleResend = async (): Promise<void> => {
    try {
      const userData = {
        Username: email,
        Pool: userPool,
      };
      const cognitoUser = new CognitoUser(userData);
      cognitoUser.resendConfirmationCode((err, result) => {
        if (err) {
          if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
          showErrorTost({
            message: err.message || "Error resending code.",
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
      });
    } catch (error: unknown) {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      showErrorTost({
        message: "Something went wrong.",
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

  const signUpCognito = () => {
    const attributeList = [
      new CognitoUserAttribute({ Name: "email", Value: email }),
      new CognitoUserAttribute({
        Name: "custom:businessType",
        Value: selectedType,
      }),
      new CognitoUserAttribute({ Name: "custom:role", Value: "owner" }),
    ];
    return new Promise((resolve, reject) => {
      userPool.signUp(email, password, attributeList, [], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  };

  const handleSignUp = useCallback(
    async (e: { preventDefault: () => void }) => {
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
      if (!selectedType)
        errors.selectedType = "Please select your business type";
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
        const result = await signUpCognito();

        if (result) {
          if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
          setShowVerifyModal(true);
          setTimer(150);
          setTimerActive(true);
        }
      } catch (error: any) {
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        const status =
          error.code === "UsernameExistsException" ? 409 : undefined;
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
    },
    [
      email,
      password,
      selectedType,
      confirmPassword,
      subscribe,
      agree,
      showErrorTost,
    ]
  );

  const businessTypes = [
    { key: "veterinaryBusiness", value: "Veterinary Business" },
    { key: "breedingFacility", value: "Breeding Facility" },
    { key: "petSitter", value: "Pet Sitter" },
    { key: "groomerShop", value: "Groomer Shop" },
  ];

  const handleSelectType = (type: React.SetStateAction<string>) => {
    setSelectedType(type);
  };

  return (
    <>
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
                        All cloud data is securely hosted in the EU with full
                        GDPR compliance.
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
                            href="/termsandconditions"
                          >
                            Terms and Conditions
                          </Link>{" "}
                          and{" "}
                          <Link className="policylink" href="/privacypolicy">
                            Privacy Policy
                          </Link>
                        </>
                      }
                      onChange={(e) => setIagree(e.target.checked)}
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
        {ErrorTostPopup}
      </section>

      {/* Verification Modal */}
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
                  <Icon
                    icon="solar:danger-circle-bold"
                    width="18"
                    height="18"
                  />{" "}
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
    </>
  );
}

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
}: MainBtnProps) {
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
}: FormInputProps) {
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
    <>
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
          <Button
            type="button"
            onClick={togglePasswordVisibility}
            tabIndex={-1}
          >
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
    </>
  );
}
// FormInputPassProps Ended
