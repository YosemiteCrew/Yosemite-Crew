import React from 'react'
import "./ClientStatementDetail.css"
import { Container } from 'react-bootstrap'

function ClientStatementDetail() {
  return (
    <section className='ClientStatementDetailSec'>
        <Container>

            <div className="ClientMainDetails">

                <div className="TopDivDetails">
                    <div className="leftdetails">
                        <div className="clienttitle">
                            <h2>Client Statement</h2>
                        </div>
                        <div className="ForDetails">
                            <span>For:</span>
                            <p>Sky B</p>
                            <p>2118 Thornridge Cir. Syracuse,</p>
                            <p>Connecticut 35624</p>
                        </div>
                    </div>
                    <div className="Rytdetails">
                        <div className="stdtldiv">
                            <p>Statement #</p>
                            <h6>3ZTABC456</h6>
                        </div>
                        <div className="stdtldiv">
                            <p>Statement Date:</p>
                            <h6>20 Jan. 2025</h6>
                        </div>
                        <div className="stdtldiv">
                            <p>Start Date:</p>
                            <h6>7 Jan 2025</h6>
                        </div>
                        <div className="stdtldiv">
                            <p>End Date:</p>
                            <h6>19 Dec 2025</h6>
                        </div>
                        <div className="stamutdiv">
                            <p>Amount Outstanding:</p>
                            <h6>$150.00</h6>
                        </div>

                    </div>
                </div>

                <div className="BottomDetailsclient">

                    <div className="DetailstabDiv">

                        <h3>Details</h3>

                        <div className="s">

                            <p>Time Range</p>

                            <div className="DateTimedetail">

                                <span>-</span>

                            </div>





                        </div>

                        

                    </div>

                    <div className="DetailsTable"></div>


                    <div className="DetailsButton"></div>








                </div>














            </div>








        </Container>

    </section>
  )
}

export default ClientStatementDetail