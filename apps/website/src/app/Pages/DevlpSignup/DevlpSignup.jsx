
import React from "react";
import "./DevlpSignup.css";
import { Col, Container, Row } from "react-bootstrap";
import { Forminput, FormPassw, HeadText } from "../SignUp/SignUp";
import { MainBtn } from "../Appointment/page";
// import whtcheck from "../../../../public/Images/whtcheck.png"

function DevlpSignup() {
  return (
  
      <section className="DevlpSignUpSec"
      style={{
        "--background-image":`url(${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/devlpbg.jpg)`
      }}
      >
        <Container>
          <div className="DevlpSignupData">
            <div className="DevSignUpText">
              <h1> <span>Build the Future</span> of <br /> Veterinary Practice <br /> Management </h1>
            </div>

            <div className="SignFormDiv">
              <form action="">

                <HeadText Spntext="Developer" blktext="Sign up" />

                <div className="FormInner">

                    <Row>
                        <Col md={6}><Forminput inlabel="First Name" intype="name"inname="name"/></Col>
                        <Col md={6}><Forminput inlabel="Last Name" intype="name"inname="name"/></Col>
                    </Row>

                  <Forminput
                    inlabel="Company Name"
                    intype="name"
                    inname="name"
                  />
                  <Forminput
                    inlabel="Email Address"
                    intype="text"
                    inname="email"
                  />
                  <div className="pasdiv">
                    <FormPassw paswlabel="Password" />
                    <p>
                      Password must be at least 8 characters long, including an
                      uppercase letter, a number, and a special character.
                    </p>
                  </div>
                  <FormPassw paswlabel="Confirm Password" />
                </div>

                <div className="Sign_check">
                  <input
                    type="checkbox"
                    className="check-input"
                    id="exampleCheck1"
                  />
                  <label className="form-check-label" htmlFor="exampleCheck1">
                    I agree to Yosemite Crew’s <span>Terms and Conditions</span>{" "}
                    and <span>Privacy Policy</span>
                  </label>
                </div>

                <div className="sinbtn">
                  <MainBtn bimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/whtcheck.png`} btext="Sign up" />
                  <h6> Already have an account?{" "}<a href="/devSignin">Login</a></h6>
                </div>

              </form>

            </div>
          </div>
        </Container>
      </section>
  
  );
}

export default DevlpSignup;
