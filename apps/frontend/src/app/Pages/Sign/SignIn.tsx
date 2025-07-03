'use client';
import Link from 'next/link';
import React , {useState} from 'react'
import { Form } from 'react-bootstrap';
import { FormInput, FormInputPass, MainBtn } from './SignUp';
import { GoCheckCircleFill } from 'react-icons/go';
import Swal from 'sweetalert2';
import { postData } from '@/app/axios-services/services';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';


function SignIn() {

   const router = useRouter()
  // const navigate = useNavigate();
  // const { initializeUser } = useAuth();
  


  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showVerifyCode, setShowVerifyCode] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState("")

  const [otp, setOtp] = useState(['', '', '', '', '', '']);

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



const handleSignIn = async (e: React.FormEvent) => {
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
    const response = await postData<{ token: string }>(
      `/api/auth/signin`,
      signInData
    );

    if (response.status === 200) {
      sessionStorage.setItem('token', response.data.token);
      router.push(`/emptydashboard`);
      Swal.fire({
        icon: 'success',
        title: 'Success',
        text: 'Sign in successful',
      });
    }
  } catch (error: unknown) {
    const axiosError = error as AxiosError<{ message: string }>;

    if (axiosError.response?.data?.message) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `Sign in failed: ${axiosError.response.data.message}`,
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

const handleOtp = async (e: React.FormEvent) => {
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
    const response = await postData<{ message: string }>(
      `/api/auth/forgotPassword`,
      { email }
    );

    if (response.status === 200) {
      Swal.fire({
        icon: 'success',
        title: 'Success',
        text: 'OTP sent successfully',
      });
      setShowVerifyCode(true);
    }
  } catch (error: unknown) {
    const axiosError = error as AxiosError<{ message: string }>;

    if (axiosError.response?.data?.message) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `OTP failed: ${axiosError.response.data.message}`,
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

const handleVerifyOtp = async (e: React.FormEvent) => {
  e.preventDefault();

  if (otp.some((digit) => digit === '')) {
    Swal.fire({
      icon: 'warning',
      title: 'Error',
      text: 'Please enter the full OTP',
    });
    return;
  }

  if (password !== confirmPassword) {
    Swal.fire({
      icon: 'warning',
      title: 'Error',
      text: 'Passwords do not match',
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
      Swal.fire({
        icon: 'success',
        title: 'Success',
        text: 'OTP verified successfully',
      });
      setShowNewPassword(false);
      setShowVerifyCode(false);
      setShowForgotPassword(false);
    }
  } catch (error: unknown) {
    const axiosError = error as AxiosError<{ message: string }>;

    if (axiosError.response && axiosError.response.data?.message) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `OTP verification failed: ${axiosError.response.data.message}`,
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


  return (
    <>

      <section className="SignInSec">
        {/* <div className="leftSignIn" style={{"--background-image":`url(${process.env.VITE_BASE_IMAGE_URL}/SignInpic.png)`}} ></div> */}
        <div className="leftSignIn" ></div>
          <div className="RightSignIn">
          
            {/* SignIn Page */}
            {!showForgotPassword && !showVerifyCode && !showNewPassword && (
              <div className="SignIninner">
                <Form>
                  <div className="TopSignInner">
                    <h2>Sign in <span>to your account</span> </h2>
                    <FormInput intype="email" inname="email" value={email} inlabel="Email Address" onChange={(e) => setEmail(e.target.value)} />
                    <FormInputPass intype="password" inname="password" value={password} inlabel="Password" onChange={(e) => setPassword(e.target.value)} />
                      
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
                      <h6> Don’t have an account? <Link href="#">Sign up.</Link></h6>
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
                  <MainBtn btnicon={<GoCheckCircleFill />} btnname="Send Code"  onClick={handleOtp} />
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
                      <FormInputPass intype="Enter New Password" inname="password" value={password} inlabel="Password" onChange={(e) => setPassword(e.target.value)} />
                      <FormInputPass intype="Confirm Password" inname="confirmPassword" value={confirmPassword} inlabel="Password" onChange={(e) => setConfirmPassword(e.target.value)} />
                    </div>
                    <div className="Signbtn">
                      <MainBtn btnicon={<GoCheckCircleFill />} btnname="Reset Password" iconPosition="left" onClick={handleVerifyOtp} />
                      <h6> Didn’t receive the code? <Link href="#">Request New Code.</Link></h6>
                    </div>
                  </Form>
                </div>

              </div>
            )}


          </div>
      </section>

      <section className='CompleteSignUpSec'>
        <div className="LeftCompleteSign" style={{"--dynamic-bg-image": `url("/Images/doctorbg.png")`} as React.CSSProperties}></div>
        <div className="RightCompleteSign">

          {!showForgotPassword && !showVerifyCode && !showNewPassword && (
            <div className="ComplteSignInner">
              <Form>

            
    
                <div className="CompleteText">
                  <h2><span>Welcome To</span> <br /> San Francisco Animal Medical Center. <br /> <span>Have a wonderful Day!</span> </h2>
                </div>
                <div className="CompletSignInpt">
                  <h6>Complete Your Sign-In</h6>
                  <div className="inputDiv">
                    <FormInput intype="email" inname="email" value={email} inlabel="Email Address" onChange={(e) => setEmail(e.target.value)} />
                    <FormInputPass intype="password" inname="password" value={password} inlabel="Password" onChange={(e) => setPassword(e.target.value)} />
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
                    <MainBtn btnicon={<GoCheckCircleFill />} btnname="Sign In" iconPosition="left"  />
                  </div>
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
                <MainBtn btnicon={<GoCheckCircleFill />} btnname="Send Code"  onClick={(e) => {
                        e.preventDefault();
                        setShowVerifyCode(true); // Show forgot password section
                      }} />
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
                    <FormInputPass intype="Enter New Password" inname="password" value={password} inlabel="Password" onChange={(e) => setPassword(e.target.value)} />
                    <FormInputPass intype="Confirm Password" inname="password" value={password} inlabel="Password" onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <div className="Signbtn">
                    <MainBtn btnicon={<GoCheckCircleFill />} btnname="Reset Password" iconPosition="left" />
                    <h6> Didn’t receive the code? <Link href="#">Request New Code.</Link></h6>
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