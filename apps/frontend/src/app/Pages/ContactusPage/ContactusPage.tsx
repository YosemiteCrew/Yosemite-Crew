import React from 'react'
import "./ContactusPage.css"
import Footer from '@/app/Components/Footer/Footer'
import { Container } from 'react-bootstrap'

function ContactusPage() {
  return (
    <>

    <section className='ContactUsPageSec'>
        <Container>
            <div className="ContactUsData">

                <div className="LeftContactUs">
                    <span>Contact us</span>
                    <h2>Need Help?  <br /> We’re All Ears!</h2>
                </div>

                <div className="RightContactUs">
                    
                </div>




            </div>

        </Container>
    </section>




    <section className='ContactInfoSec'>
        <Container>
            <div className='ContactInfoData'>
                <div className="LeftContInfo">
                    <span>Contact Info</span>
                    <h2>We are happy to <br /> assist you</h2>
                </div>
                <div className="ContactInfoDetail">

                    <div className="LeftDetails">
                        <div className="detailitem">
                            <h4>Email Address</h4>
                        </div>
                        <div className="detailTexed">
                            <h6>help@yosemitecrew.com</h6>
                            <p>Assistance hours: Monday - Friday 6 am to 8 pm EST</p>
                        </div>
                    </div>

                    <div className="LeftDetails">
                        <div className="detailitem">
                            <h4>Phone</h4>
                        </div>
                        <div className="detailTexed">
                            <h6>(808) 998-34256</h6>
                            <p>Assistance hours: Monday - Friday 6 am to 8 pm EST</p>
                        </div>
                    </div>

                </div>
            </div>
        </Container>
    </section>

    <Footer/>

    </>
  )
}

export default ContactusPage