'use client';
import React,{ useState } from 'react'
import "./Sign.css"
import { Button, Col, Container, Form, Row } from 'react-bootstrap'
import Image from "next/image";
import { GoCheckCircleFill } from 'react-icons/go'
import Link from 'next/link';



function SignUp() {

  


  const [selectedType, setSelectedType] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const businessTypes = [
    'Veterinary Business',
    'Breeding Facility',
    'Pet Sitter',
    'Groomer Shop',
  ];
 const handleSelectType = (type: React.SetStateAction<string>) => {
    setSelectedType(type);
  };

  


  return (
    <>

    <section className='MainSignUpSec'>
      <Container>
        <Row >

          <Col md={6}>

            <div className="BuildEveryone">

              <div className="BuildText">
                <h2>Built for Everyone, from Day One.</h2>
              </div>

              <div className="BuildCloud">

                <div className="CloudItems">
                  <div className="CloudIcon">
                    <span><GoCheckCircleFill /></span>
                  </div>
                  <div className="CloudText">
                    <h4>Cloud or Self-Hosted — You Decide.</h4>
                    <p>Use our managed cloud service or deploy on your own infrastructure. Total flexibility, no lock-in.</p>
                  </div>
                </div>

                <div className="CloudItems">
                  <div className="CloudIcon">
                    <span><GoCheckCircleFill /></span>
                  </div>
                  <div className="CloudText">
                    <h4>Start Free. Pay as You Grow.</h4>
                    <p>Enjoy generous free usage on cloud hosting. Upgrade only when you need more power.</p>
                  </div>
                </div>

                <div className="CloudItems">
                  <div className="CloudIcon">
                    <span><GoCheckCircleFill /></span>
                  </div>
                  <div className="CloudText">
                    <h4>GDPR-Ready, EU-Based Servers.</h4>
                    <p>All cloud data is securely hosted in the EU with full GDPR compliance.</p>
                  </div>
                </div>

              </div>

            </div>
          
          </Col>

          <Col md={6}>

            <div className="SignUpFormDiv">
              <Form >

                <div className="TopSignUp">

                  <div className="Headingtext">
                    <h2>Sign up now  </h2>
                  </div>

                  <div className="SignFormItems">
                    <FormInput intype="email" inname="email" value={email} inlabel="Add Work Email" onChange={(e) => setEmail(e.target.value)} />
                    <FormInputPass intype="password" inname="password" value={password} inlabel="Set up Password" onChange={(e) => setPassword(e.target.value)} />
                    <FormInputPass intype="password" inname="password" value={password} inlabel="Set up Password" onChange={(e) => setPassword(e.target.value)} />
                  </div>

                  <div className="business-type-container">
                    <p>Select Your Business Type</p>
                    <div className="button-group">
                      <ul>
                        {businessTypes.map((type) => (
                          <li key={type} className={`business-button ${ selectedType === type ? 'selected' : ''  }`} onClick={() => handleSelectType(type)} >
                            {type}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                </div>

                <div className="Sign_check">
                  <Form.Check type="checkbox"  label="I agree to Yosemite Crew’s Terms and Conditions and Privacy Policy" />
                  <Form.Check type="checkbox"  label="Sign me up for Newsletter and Promotional emails"/>
                </div>

                <div className="Signbtn">
                  <MainBtn btnicon={<GoCheckCircleFill />} btnname="Sign up" iconPosition="left"  />
                  {/* <MainBtn btnname="Sign up" btnicon={<GoCheckCircleFill />} iconPosition="left" /> */}
                  <h6> Already have an account? <Link href="/pages/SignIn">Login</Link></h6>
                </div>

                
              </Form>
            </div>
          
          </Col>

        </Row>



      </Container>

    </section>

    <section className='CompleteSignUpSec' >
      <div className="LeftCompleteSign" style={{"--dynamic-bg-image": `url("/Images/doctorbg.png")`} as React.CSSProperties}></div>
      <div className="RightCompleteSign">

        <div className="ComplteSignInner">
          <Form>

            <div className="CompleteText">
              <h2>San Francisco Animal Medical Center <span>has invited you to join their team on Yosemite Crew</span> </h2>
            </div>


            <div className="CompletSignInpt">

              <h6>Complete Your Sign-Up</h6>


              <div className="inputDiv">
                <FormInput intype="email" inname="email" value={email} inlabel="Email Address" onChange={(e) => setEmail(e.target.value)} />
                <div className="pasdiv">
                  <FormInputPass intype="password" inname="password" value={password} inlabel="Password" onChange={(e) => setPassword(e.target.value)} />
                  <p>Password must be at least 8 characters long, including an uppercase letter, a number, and a special character.</p>
                </div>
                <FormInputPass intype="password" inname="password" value={confirmPassword} inlabel="Confirm Password" onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>


              <div className="Signbtn">
                <MainBtn btnicon={<GoCheckCircleFill />} btnname="Complete Sign up" iconPosition="left"  />
              </div>


            </div>







          </Form>

        </div>



      </div>

    </section>

    </>
  )
}

export default SignUp



// MainBtnProps started 
type MainBtnProps = {
  btnname: string;
  btnicon?: React.ReactNode;
  iconPosition?: 'left' | 'right'; 
 onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; 
}
export function MainBtn({ btnname, btnicon, iconPosition ,onClick }: MainBtnProps) {
  return (
    <Button className='BlackButton' type='button' onClick={onClick}>
      {iconPosition === 'left' && btnicon && <span>{btnicon}</span>}
      <span className="mx-1">{btnname}</span>
      {iconPosition === 'right' && btnicon && <span>{btnicon}</span>}
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
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
export function FormInput({ intype, inname ,inlabel ,value ,onChange }: FormInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={`SignInput floating-input ${isFocused || value ? "focused" : ""}`}>
      <input
        type={intype}
        name={inname}
        id={inname}
        value={value}
        onChange={onChange}
        autoComplete="off"
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
}
export function FormInputPass({ intype, inname ,inlabel ,value ,onChange }: FormInputPassProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className={`SignPassInput floating-input ${isFocused || value ? "focused" : ""}`}>
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
        <Image aria-hidden src="/Images/eyes.png" alt="eyes" width={24} height={24} />
      </Button>
    </div>
  );
}
// FormInputPassProps Ended
