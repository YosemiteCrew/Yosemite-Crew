'use client';
import Link from 'next/link';
import React , {useState} from 'react'
import { Form } from 'react-bootstrap';
import { FormInput, FormInputPass, MainBtn } from './SignUp';
import { GoCheckCircleFill } from 'react-icons/go';


function SignIn() {


  // const navigate = useNavigate();
  // const { initializeUser } = useAuth();
  


  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showVerifyCode, setShowVerifyCode] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
                      <MainBtn btnicon={<GoCheckCircleFill />} btnname="Sign in" iconPosition="left" />
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
                          maxLength="1"
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
                        maxLength="1"
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