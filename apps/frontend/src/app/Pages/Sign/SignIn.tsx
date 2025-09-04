'use client';
import Link from 'next/link';
import React, { useState } from 'react'
import { Form } from 'react-bootstrap';
import { FormInput, FormInputPass, MainBtn, ErrorTost } from './SignUp';
import { GoCheckCircleFill } from 'react-icons/go';
import { Icon } from "@iconify/react/dist/iconify.js";
import { postData } from '@/app/axios-services/services';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import { useAuthStore } from '../../stores/authStore';


function useErrorTost() {
  const [errorTost, setErrorTost] = useState<{
    show: boolean;
    message?: string;
    errortext?: string;
    iconElement?: React.ReactNode;
    className?: string;
  }>({ show: false });

  const showErrorTost = (
    {
      message,
      errortext,
      iconElement,
      className = "",
      duration = 2000
    }: {
      message: string;
      errortext: string;
      iconElement: React.ReactNode;
      className?: string;
      duration?: number;
    }
  ) => {
    setErrorTost({ show: true, message, errortext, iconElement, className });
    setTimeout(() => setErrorTost({ show: false }), duration);
  };

  const ErrorTostPopup = errorTost.show ? (
    <ErrorTost
      className={errorTost.className || ""}
      message={errorTost.message || ""}
      errortext={errorTost.errortext || ""}
      iconElement={errorTost.iconElement}
      onClose={() => setErrorTost({ show: false })}
    />
  ) : null;

  return { showErrorTost, ErrorTostPopup };
}

function SignIn() {

  const router = useRouter()
  // const navigate = useNavigate();
  // const { initializeUser } = useAuth();



  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showVerifyCode, setShowVerifyCode] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inputErrors, setInputErrors] = useState<{ email?: string; password?: string }>({});

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const setVerified = useAuthStore((state) => state.setVerified);
  const isVerified = useAuthStore((state) => state.isVerified);
  const userType = useAuthStore((state) => state.userType);

  console.log(isVerified," isVerified in SignIn");
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, index: number) => {
    const value = e.target.value;

    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < otp.length - 1) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  // Handle OTP input key down (to handle backspace)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, index: number) => {
    if (e.key === 'Backspace' && otp[index] === '') {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };


  const { showErrorTost, ErrorTostPopup } = useErrorTost();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: { email?: string; password?: string } = {};
    if (!email) errors.email = "Email is required";
    if (!password) errors.password = "Password is required";

    setInputErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    const signInData = { email, password };

    try {
      const response = await postData<{ message: string; data?: { userId: string; email: string; userType: string } }>(
        `/api/auth/signin`,
        signInData, {
        withCredentials: true,
      }
      );

      if (response.status === 200 && response.data?.data) {
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        const { userId, email, userType } = response.data.data;
        useAuthStore.getState().setUser({ userId, email, userType });
        setVerified(true);
        showErrorTost({
          message: response.data.message || 'Sign in successful',
          errortext: 'Success',
          iconElement: <Icon icon="solar:danger-triangle-bold" width="20" height="20" color="#00C853" />,
          className: "CongratsBg"
        });
        router.push("/emptydashboard");
      }
    } catch (error: unknown) {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      const axiosError = error as AxiosError<{ message: string }>;
      showErrorTost({
        message: `Sign in failed: ${axiosError.response?.data?.message || 'Unable to connect to the server.'}`,
        errortext: 'Error',
        iconElement: <Icon icon="solar:danger-triangle-bold" width="20" height="20" color="#EA3729" />,
        className: "errofoundbg"
      });
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      showErrorTost({
        message: 'Email is required',
        errortext: 'Error',
        iconElement: <Icon icon="solar:danger-triangle-bold" width="20" height="20" color="#EA3729" />,
        className: "errofoundbg"
      });
      return;
    }

    try {
      const response = await postData<{ message: string }>(
        `/api/auth/forgotPassword`,
        { email }
      );

      if (response.status === 200) {
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        showErrorTost({
          message: 'OTP sent successfully',
          errortext: 'Success',
          iconElement: <Icon icon="solar:danger-triangle-bold" width="20" height="20" color="#00C853" />,
          className: "CongratsBg"
        });
        setShowVerifyCode(true);
      }
    } catch (error: unknown) {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      const axiosError = error as AxiosError<{ message: string }>;
      showErrorTost({
        message: `OTP failed: ${axiosError.response?.data?.message || 'Unable to connect to the server.'}`,
        errortext: 'Error',
        iconElement: <Icon icon="solar:danger-triangle-bold" width="20" height="20" color="#EA3729" />,
        className: "errofoundbg"
      });
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (otp.some((digit) => digit === '')) {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      showErrorTost({
        message: 'Please enter the full OTP',
        errortext: 'Error',
        iconElement: <Icon icon="solar:danger-triangle-bold" width="20" height="20" color="#EA3729" />,
        className: "errofoundbg"
      });
      return;
    }

    if (password !== confirmPassword) {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      showErrorTost({
        message: 'Passwords do not match',
        errortext: 'Error',
        iconElement: <Icon icon="solar:danger-triangle-bold" width="20" height="20" color="#EA3729" />,
        className: "errofoundbg"
      });
      return;
    }

    const data = {
      email,
      otp: otp.join(''),
      password,
    };

    try {
      const response = await postData<{ message: string }>(
        `/api/auth/verifyotp`,
        data
      );

      if (response.status === 200) {
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        showErrorTost({
          message: 'OTP verified successfully',
          errortext: 'Success',
          iconElement: <Icon icon="solar:danger-triangle-bold" width="20" height="20" color="#00C853" />,
          className: "CongratsBg"
        });
        setShowNewPassword(false);
        setShowVerifyCode(false);
        setShowForgotPassword(false);
      }
    } catch (error: unknown) {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      const axiosError = error as AxiosError<{ message: string }>;
      showErrorTost({
        message: `OTP verification failed: ${axiosError.response?.data?.message || 'Unable to connect to the server.'}`,
        errortext: 'Error',
        iconElement: <Icon icon="solar:danger-triangle-bold" width="20" height="20" color="#EA3729" />,
        className: "errofoundbg"
      });
    }
  };
  const redirectToDashboard = () => { 
    if(userType === "veterinaryBusiness"){
      router.push("/emptydashboard");
    } else if(userType === "breedingFacility"){  
      router.push("/DoctorDashboard"); 
    } else if(userType === "petSitter"){  
      router.push("/DoctorDashboard");
    }else if(userType === "groomerShop"){  
      router.push("/DoctorDashboard");
    }    
   }
if(isVerified){
  return (
    <div className="alreadySignedIn">
      <h2>You are already signed in!</h2>
      <p>Please log out to sign in with a different account.</p>
      <MainBtn btnname="Go to Dashboard" onClick={() => redirectToDashboard()} />
    </div>     )   
}
  

  return (
    <>
     

      <section className="SignInSec">

        {ErrorTostPopup}
        
        {/* <div className="leftSignIn" style={{"--background-image":`url(${process.env.VITE_BASE_IMAGE_URL}/SignInpic.png)`}} ></div> */}
        <div className="leftSignIn" ></div>
        <div className="RightSignIn">

          {/* SignIn Page */}
          {!showForgotPassword && !showVerifyCode && !showNewPassword && (
            <div className="SignIninner">
              <Form onSubmit={handleSignIn}>
                <div className="TopSignInner">
                  <h2>Sign in <span>to your account</span> </h2>
                  <FormInput
                    intype="email"
                    inname="email"
                    value={email}
                    inlabel="Email Address"
                    onChange={(e) => setEmail(e.target.value)}
                    error={inputErrors.email}
                  />
                  
                  <FormInputPass
                    inPlaceHolder='Enter your password'
                    intype="password"
                    inname="password"
                    value={password}
                    inlabel="Password"
                    onChange={(e) => setPassword(e.target.value)}
                    error={inputErrors.password}
                  />

                  <div className="forgtbtn">
                    <Link href=""
                      onClick={(e) => {
                        e.preventDefault();
                        setShowForgotPassword(true); // Show forgot password section
                      }}
                    >
                      Forgot Password?
                    </Link>
                  </div>
                </div>
                <div className="Signbtn">
                  <MainBtn btnicon={<GoCheckCircleFill />} btnname="Sign in" iconPosition="left" onClick={handleSignIn} />
                  <h6> Don’t have an account? <Link href="/signup">Sign up.</Link></h6>
                </div>
              </Form>
            </div>
          )}

          {/* Forgot Password Page */}
          {showForgotPassword && !showVerifyCode && !showNewPassword && (
            <div className="SignIninner">
              <div className="ForgetHead">
                <h2>Forgot <span>password?</span> </h2>
                <p> Enter your registered email, and we’ll send you a code to reset it.</p>
              </div>
              <Form>
                <FormInput intype="email" inname="email" value={email} inlabel="Email Address" onChange={(e) => setEmail(e.target.value)} />
                <MainBtn btnicon={<GoCheckCircleFill />} btnname="Send Code" onClick={handleOtp} />
              </Form>
            </div>
          )}

          {/* Verify Code Page */}
          {showVerifyCode && !showNewPassword && (
            <div className="ss">
              <div className="SignIninner">
                <div className="ForgetHead">
                  <h2>Verify <span>Code</span> </h2>
                  <p> Enter the code we just sent to your email to proceed with resetting your password.</p>
                </div>

                <Form>
                  <div className="verifyInput">
                    {otp.map((digit, index) => (
                      <Form.Control
                        key={index}
                        type="text"
                        value={digit}
                        id={`otp-input-${index}`}
                        onChange={(e) => handleChange(e, index)}
                        onKeyDown={(e) => handleKeyDown(e, index)} // Handle backspace
                        maxLength={1}
                      />
                    ))}
                  </div>


                </Form>
              </div>

              <div className="SignIninner">
                <Form>
                  <div className="TopSignInner">
                    <h2>Set <span>new password</span> </h2>
                    <FormInputPass  intype="password" inPlaceHolder="Enter New Password" inname="password" value={password} inlabel="Enter New Password" onChange={(e) => setPassword(e.target.value)} />
                    <FormInputPass  intype="password" inPlaceHolder="Confirm Password" inname="confirmPassword" value={confirmPassword} inlabel="Confirm Password" onChange={(e) => setConfirmPassword(e.target.value)} />
                  </div>
                  <div className="Signbtn">
                    <MainBtn btnicon={<GoCheckCircleFill />} btnname="Reset Password" iconPosition="left" onClick={handleVerifyOtp} />
                    <h6> Didn’t receive the code? <Link  onClick={handleOtp} href="#">Request New Code.</Link></h6>
                  </div>
                </Form>
              </div>

            </div>
          )}


        </div>
      </section>

    

     

    </>
  )
}

export default SignIn
/* Removed unused setInputErrors function */

