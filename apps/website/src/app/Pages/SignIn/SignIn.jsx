// eslint-disable-next-line no-unused-vars
import React, { useEffect, useState } from 'react';
import './SignIn.css';
import { Button, Form } from 'react-bootstrap';
import { Forminput, FormPassw } from '../SignUp/SignUp';
import { MainBtn } from '../Appointment/page';
import whtcheck from '../../../../public/Images/whtcheck.png';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/useAuth';

function SignIn() {
  const navigate = useNavigate();
  const { initializeUser } = useAuth();

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showVerifyCode, setShowVerifyCode] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [otp, setOtp] = useState(['', '', '', '', '', '']);

  const handleChange = (e, index) => {
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
  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && otp[index] === '') {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      Swal.fire({
        icon: 'warning',
        title: 'Error',
        text: 'Email and Password are required',
      });
      return;
    }

    const signInData = { email, password };

    try {
      const response = await axios.post(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/auth/signin`,
        signInData
      );

      if (response.status === 200) {
        // Store the token and refreshToken in sessionStorage
        sessionStorage.setItem('token', response.data.token);
        // sessionStorage.setItem("refreshToken", response.data.refreshToken);

        // Initialize user after storing token
        initializeUser();

        // Navigate to dashboard
        navigate('/dashboard');

        // Display success alert
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Sign in successful',
        });
      }
    } catch (error) {
      if (error.response) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: `Sign in failed: ${error.response.data.message}`,
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Sign in failed: Unable to connect to the server.',
        });
      }
    }
  };

  const handleOtp = async (e) => {
    e.preventDefault();
    if (!email) {
      Swal.fire({
        icon: 'warning',
        title: 'Error',
        text: 'Email is required',
      });
      return;
    }

    try {
      const response = await axios.post(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/auth/forgotPassword`,
        { email }
      );
      if (response.status === 200) {
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'OTP sent successfully',
        });
        setShowVerifyCode(true);
        setShowForgotPassword(false);
      }
    } catch (error) {
      if (error.response) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: `OTP failed: ${error.response.data.message}`,
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'OTP failed: Unable to connect to the server.',
        });
      }
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.some((digit) => digit === '')) {
      Swal.fire({
        icon: 'warning',
        title: 'Error',
        text: 'Please enter the full OTP',
      });
      return;
    }

    const data = { email, otp: otp.join('') };
    try {
      const response = await axios.post(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/auth/verifyotp`,
        data
      );
      if (response.status === 200) {
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'OTP verified successfully',
        });
        setShowNewPassword(true);
        setShowVerifyCode(false);
      }
    } catch (error) {
      if (error.response) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: `OTP verification failed: ${error.response.data.message}`,
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'OTP verification failed: Unable to connect to the server.',
        });
      }
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      Swal.fire({
        icon: 'warning',
        title: 'Error',
        text: 'Passwords do not match',
      });
      return;
    }
    const data = { password, email };
    try {
      const response = await axios.post(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/auth/updatepassword`,
        data
      );
      if (response.status === 200) {
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Password updated successfully',
        });
        setShowNewPassword(false);
        setShowForgotPassword(false);
        setShowVerifyCode(false);
      }
    } catch (error) {
      if (error.response) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: `Password reset failed: ${error.response.data.message}`,
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Password reset failed: Unable to connect to the server.',
        });
      }
    }
  };

  return (
    <>
      <section className="SignInSec">
        <div className="leftSignIn"></div>
        <div className="RightSignIn">
          {/* SignIn Page */}
          {!showForgotPassword && !showVerifyCode && !showNewPassword && (
            <div className="SignIninner">
              <h2>
                <span>Sign in</span> to your account
              </h2>
              <Form
              // onSubmit={handleSignIn}
              >
                <Forminput
                  inlabel="Email Address"
                  intype="text"
                  inname="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <FormPassw
                  paswlabel="Password"
                  intype="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <div className="forgtbtn">
                  <Link
                    onClick={(e) => {
                      e.preventDefault();
                      setShowForgotPassword(true); // Show forgot password section
                    }}
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="sinbtn">
                  <MainBtn
                    // btntyp="submit"
                    bimg={whtcheck}
                    btext="Sign In"
                    onClick={handleSignIn}
                  />
                  <h6>
                    Don’t have an account? <Link to="/signup">Sign up.</Link>
                  </h6>
                </div>
              </Form>
            </div>
          )}

          {/* Forgot Password Page */}
          {showForgotPassword && !showVerifyCode && !showNewPassword && (
            <div className="SignIninner">
              <div className="signhed">
                <h2>
                  <span>Forgot</span> password?
                </h2>
                <p>
                  Enter your registered email, and we’ll send you a code to
                  reset it.
                </p>
              </div>

              <Form>
                <Forminput
                  inlabel="Email Address"
                  intype="text"
                  inname="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <MainBtn btext="Send Code" onClick={handleOtp} />
              </Form>
            </div>
          )}

          {/* Verify Code Page */}
          {showVerifyCode && !showNewPassword && (
            <div className="SignIninner">
              <div className="signhed">
                <h2>
                  <span>Verify</span> Code
                </h2>
                <p>
                  Enter the code we just sent to your email to proceed with
                  resetting your password.
                </p>
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
                      maxLength="1"
                    />
                  ))}
                </div>

                <div className="sinbtn">
                  <MainBtn btext="Verify Code" onClick={handleVerifyOtp} />
                  <h6>
                    Didn’t receive the code?{' '}
                    <Link to="/signup">Request New Code.</Link>
                  </h6>
                </div>
              </Form>
            </div>
          )}

          {/* New Password Page */}
          {showNewPassword && (
            <div className="SignIninner">
              <h2>
                <span>Set</span> new password
              </h2>

              <Form>
                <FormPassw
                  paswlabel="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <FormPassw
                  paswlabel="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />

                <MainBtn
                  bimg={whtcheck}
                  btext="Reset Password"
                  onClick={handleResetPassword}
                />
              </Form>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export default SignIn;
