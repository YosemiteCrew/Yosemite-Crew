"use client";
import React, { useCallback, useState, useRef, useEffect } from "react";
import "./Sign.css";
import { Button, Col, Container, Form, Row, Modal } from "react-bootstrap";
import Image from "next/image";
import { GoCheckCircleFill } from "react-icons/go";
import Link from "next/link";
import Swal from "sweetalert2";
import { getData, postData } from "@/app/axios-services/services";
import { AxiosError } from "axios";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/app/stores/authStore";

type SignUpProps = {
  inviteCode?: string
};
function SignUp({ inviteCode }: SignUpProps) {
  const router = useRouter();
  //role
  const [selectedType, setSelectedType] = useState("");
  //emails
  const [email, setEmail] = useState("")
  //department
  const [department, setDepartment] = useState("");
  const [invitedBy, setInvitedBy] = useState('')
  //password
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  //otp
  const [code, setCode] = useState(Array(6).fill(""));
  const [activeInput, setActiveInput] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [agree, setIagree] = useState(false)
  const [subscribe, setSubscribe] = useState(false)
  console.log("agree", agree)
  // Stable ref callback to avoid React warning
  const setOtpRef = (el: HTMLInputElement | null, idx: number) => {
    otpRefs.current[idx] = el;
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
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

  const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
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
    if (code.includes('')) {
      Swal.fire({
        icon: 'warning',
        title: 'Error',
        text: 'Please enter the full OTP',
      });
      return;
    }

    try {
      const response = await postData<
        { message: string; data?: { userId: string; email: string; userType: string } }
      >(
        '/api/auth/verifyUser',
        {
          email,
          otp: code.join('')
        },
        {
          withCredentials: true
        }
      );

      if (response.status === 200 && response.data?.data) {
        const { userId, email, userType } = response.data.data;

        console.log("User Data:", userId, email, userType);

        // 👇 Save to Zustand
        useAuthStore.getState().setUser({ userId, email, userType });

        // 👇 Double-check if it's saved
        // const storeData = useAuthStore.getState();
        // console.log("Saved in Zustand:", storeData);
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: response.data.message,
        });
        setCode(Array(6).fill(""));
        setShowVerifyModal(false);
        // sessionStorage.setItem('token', response.data.token);

        router.push(`/emptydashboard`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `OTP verification failed: ${error.response?.data?.message || 'Unable to connect to the server.'
          }`,
      });
    }
  };

  const handleResend = async (): Promise<void> => {

    const formData = {
      email,
      password,
      businessType: selectedType,
    };

    try {
      const response = await postData<{ message: string }, typeof formData>(
        `/api/auth/register`,
        formData
      );

      if (response.status === 200) {
        Swal.fire({
          icon: 'info',
          title: 'Code Resent',
          text: 'A new verification code has been sent to your email.',
        });
      }
    } catch (error: unknown) {
      let message = 'Something went wrong.';

      if (error && typeof error === 'object' && 'isAxiosError' in error) {
        const axiosError = error as AxiosError<{ message: string }>;
        message = axiosError.response?.data?.message || message;
      }

      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: message,
      });
    }
  };
  const handleSignUp = useCallback(async () => {
    // Always validate passwords
    if (password !== confirmPassword) {
      Swal.fire({
        icon: 'warning',
        title: 'Password Mismatch',
        text: 'Password and Confirm Password do not match.',
      });
      return;
    }

    // Only validate these if user is not invited (i.e., role is not provided)
    if (!inviteCode) {
      if (!selectedType) {
        Swal.fire({
          icon: 'warning',
          title: 'Business Type Not Selected',
          text: 'Please select your business type.',
        });
        return;
      }

      if (!subscribe) {
        Swal.fire({
          icon: 'warning',
          title: 'Newsletter Not Checked',
          text: 'Please check the Newsletter and Promotional emails box.',
        });
        return;
      }

      if (!agree) {
        Swal.fire({
          icon: 'warning',
          title: 'Terms Not Agreed',
          text: 'Please check the "I agree to Terms and Conditions" box.',
        });
        return;
      }
    }

    const formData = {
      email,
      password,
      role: selectedType,
      subscribe,
      department,
      invitedBy,
      inviteCode, // Include inviteCode if available
    };

    const url = !inviteCode ? "/api/auth/register" : "/fhir/v1/invitedregister";

    try {
      const data = await postData<{ message: string }>(url, formData);

      if (data?.status === 200) {
        console.log("Signup successful", data)
        setShowVerifyModal(true); // Show modal after signup
      }
    } catch (error: unknown) {
      ;
      let status: number | undefined;
      let message: string = 'Something went wrong.';

      if (
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: unknown }).response === "object" &&
        (error as { response?: { status?: number; data?: { message?: string } } }).response !== null
      ) {
        const errResp = (error as { response: { status?: number; data?: { message?: string } } }).response;
        status = errResp.status;
        message = errResp.data?.message || message;
      }

      if (status === 409) {
        Swal.fire({
          icon: 'error',
          title: 'Already Registered',
          text: message,
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Signup Error',
          text: message,
        });
      }

      // For testing only: remove this if not needed
      setShowVerifyModal(false);
    }
  }, [email, password, selectedType, confirmPassword, subscribe, agree, department, invitedBy, inviteCode]);



  const businessTypes = [
    "Veterinary Business",
    "Breeding Facility",
    "Pet Sitter",
    "Groomer Shop",
  ];
  const handleSelectType = (type: React.SetStateAction<string>) => {
    setSelectedType(type);
  };

  useEffect(() => {
    const response = async () => {
      if (inviteCode) {
        try {
          const data = await getData<{ email: string; role: string; department: string; invitedBy: string }>(
            `/fhir/v1/inviteInfo?code=${inviteCode}`
          );
          if (data?.status === 200) {
            setEmail(data.data.email);
            setSelectedType(data.data.role);
            setDepartment(data.data.department);
            setInvitedBy(data.data.invitedBy);
          }
        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: `${error instanceof Error ? error.message : 'Unable to fetch invite details.'}`,
          })
        }
      }
    }
    response();
  }, [inviteCode]);





  return (
    <>

      {!inviteCode ? <section className="MainSignUpSec">
        <Container>
          <Row>
            <Col md={6}>
              <div className="BuildEveryone">
                <div className="BuildText">
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
                      <h4>Cloud or Self-Hosted — You Decide.</h4>
                      <p>
                        Use our managed cloud service or deploy on your own
                        infrastructure. Total flexibility, no lock-in.
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
                <Form>
                  <div className="TopSignUp">
                    <div className="Headingtext">
                      <h2>Sign up now </h2>
                    </div>

                    <div className="SignFormItems">
                      <FormInput
                        intype="email"
                        inname="email"
                        value={email}
                        inlabel="Enter Email Address"
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <FormInputPass
                        intype="password"
                        inname="password"
                        value={password}
                        inlabel="Set up Password"
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <FormInputPass
                        intype="password"
                        inname="password"
                        value={confirmPassword}
                        inlabel="Confirm Password"
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>

                    <div className="business-type-container">
                      <p>Select Your Business Type</p>
                      <div className="button-group">
                        <ul>
                          {businessTypes.map((type) => (
                            <li
                              key={type}
                              className={`business-button ${selectedType === type ? "selected" : ""}`}
                              onClick={() => handleSelectType(type)}
                            >
                              {type}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="Sign_check">
                    <Form.Check
                      type="checkbox"
                      label="I agree to Yosemite Crew’s Terms and Conditions and Privacy Policy"
                      onChange={(e) => setIagree(e.target.checked)}
                    />

                    <Form.Check
                      type="checkbox"
                      label="Sign me up for Newsletter and Promotional emails"
                      onChange={(e) => setSubscribe(e.target.checked)}
                    />
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
                      Already have an account?{" "}
                      <Link href="/signin">Login</Link>
                    </h6>
                  </div>
                </Form>
              </div>
            </Col>
          </Row>
        </Container>
      </section> :

        <section className="CompleteSignUpSec">
          <div
            className="LeftCompleteSign"
            style={
              {
                "--dynamic-bg-image": `url("/Images/doctorbg.png")`,
              } as React.CSSProperties
            }
          ></div>
          <div className="RightCompleteSign">
            <div className="ComplteSignInner">
              <Form>
                <div className="CompleteText">
                  <h2>
                    San Francisco Animal Medical Center{" "}
                    <span>
                      has invited you to join their team on Yosemite Crew
                    </span>{" "}
                  </h2>
                </div>

                <div className="CompletSignInpt">
                  <h6>Complete Your Sign-Up</h6>

                  <div className="inputDiv">
                    <FormInput
                      readonly={true}
                      intype="email"
                      inname="email"
                      value={email}
                      inlabel="Email Address"
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <div className="pasdiv">
                      <FormInputPass
                        intype="password"
                        inname="password"
                        value={password}
                        inlabel="Password"
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <p>
                        Password must be at least 8 characters long, including an
                        uppercase letter, a number, and a special character.
                      </p>
                    </div>
                    <FormInputPass
                      intype="password"
                      inname="password"
                      value={confirmPassword}
                      inlabel="Confirm Password"
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>

                  <div className="Signbtn">
                    <MainBtn
                      btnicon={<GoCheckCircleFill />}
                      btnname="Complete Sign up"
                      iconPosition="left"
                      onClick={handleSignUp}
                    />
                  </div>
                </div>
              </Form>
            </div>
          </div>
        </section>}

      {/* Verification Modal */}
      <Modal
        show={showVerifyModal}
        onHide={() => setShowVerifyModal(false)}
        centered
        contentClassName="verify-modal"
      >
        <Modal.Body>
          <div style={{ textAlign: "center", padding: "24px 12px" }}>
            <h2 style={{ fontWeight: 600, fontSize: 28, marginBottom: 8 }}>Verify <span style={{ color: "#888" }}>code</span></h2>
            <p style={{ color: "#888", marginBottom: 24 }}>
              Enter the code we just sent to your email to proceed with resetting your password.
            </p>
            <div className="verifyInput" style={{ marginBottom: 24 }}>
              {code.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => setOtpRef(el, idx)}
                  type="text"
                  maxLength={1}
                  value={digit}
                  autoFocus={activeInput === idx}
                  onChange={e => handleCodeChange(e, idx)}
                  onKeyDown={e => handleCodeKeyDown(e, idx)}
                  style={{
                    width: 56,
                    height: 64,
                    fontSize: 32,
                    border: "1px solid #ccc",
                    borderRadius: 8,
                    textAlign: "center",
                    marginRight: idx < 5 ? 8 : 0,
                  }}
                />
              ))}
            </div>
            <Button
              style={{
                width: "100%",
                borderRadius: 24,
                background: "#222",
                border: "none",
                fontSize: 20,
                padding: "12px 0",
                marginBottom: 16,
              }}
              onClick={handleVerify}
            >
              Verify Code
            </Button>
            <div>
              <span style={{ color: "#888" }}>Didn&apos;t receive the code?</span>{" "}
              <Button
                variant="link"
                style={{ color: "#007bff", padding: 0, fontWeight: 500, textDecoration: "underline" }}
                onClick={handleResend}
              >
                Request New Code.
              </Button>
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
    <Button className="BlackButton" type="button" onClick={onClick}>
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
  inname: string;
  value: string;
  inlabel: string;
  readonly?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};
export function FormInput({
  intype,
  inname,
  inlabel,
  value,
  onChange,
  readonly
}: FormInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div
      className={`SignInput floating-input ${isFocused || value ? "focused" : ""}`}
    >
      <input
        type={intype}
        name={inname}
        id={inname}
        value={value}
        onChange={onChange}
        autoComplete="off"
        readOnly={readonly}
        required
        placeholder=" " // <-- Add a single space as placeholder
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      <label htmlFor={inname}>{inlabel}</label>
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
};
export function FormInputPass({
  intype,
  inname,
  inlabel,
  value,
  onChange,
}: FormInputPassProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div
      className={`SignPassInput floating-input ${isFocused || value ? "focused" : ""}`}
    >
      <input
        type={showPassword ? "text" : intype}
        name={inname}
        id={inname}
        value={value}
        autoComplete="new-password"
        onChange={onChange}
        required
        placeholder=" " // <-- Add a single space as placeholder
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      <label htmlFor={inname}>{inlabel}</label>
      <Button type="button" onClick={togglePasswordVisibility} tabIndex={-1}>
        <Image
          aria-hidden
          src="/Images/eyes.png"
          alt="eyes"
          width={24}
          height={24}
        />
      </Button>
    </div>
  );
}
// FormInputPassProps Ended