
import React from 'react'
import "./DevlpSignin.css"
import { Container } from 'react-bootstrap'
import { Forminput, FormPassw, HeadText } from '../SignUp/SignUp'
import { MainBtn } from '../Appointment/page'
// import whtcheck from "../../../../public/Images/whtcheck.png"
import { Link } from 'react-router-dom'

function DevlpSignin() {
  return (
  
    <section className="DevlpSignInSec"
    style={{
        "--background-image":`url(${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/devsigninbg.png)`
  
    }}
    >
        <Container>
            <div className="DevlpSignInData">
                <div className="ss"></div>
                <div className="SignFormDiv">
                    <form action="">
                        <HeadText Spntext="Welcome" blktext="back" />
                        <div className="FormInner">
                            <Forminput inlabel="Email Address" intype="text" inname="email"/>
                            <div className="forgtdiv">
                                <FormPassw paswlabel="Password" />
                                <Link to="#">Forgot Password?</Link>
                            </div>
                        </div>
                        <div className="Sign_check">
                            <input type="checkbox"className="check-input" id="exampleCheck1"/>
                            <label className="form-check-label" htmlFor="exampleCheck1"> Keep me logged-in </label>
                        </div>
                        <MainBtn bimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/whtcheck.png`} btext="Sign in" />
                    </form>
                </div>
            </div>
        </Container>
    </section>
  )
}

export default DevlpSignin