
import React, { useState } from 'react'
import "./Pricing.css"
import PropTypes from 'prop-types';
import FAQ from '../../Components/FAQ/FAQ';
// import heart from "../../../../public/Images/heart.png"
// import { MainBtn } from '../Appointment/page';
// import batery from "../../../../public/Images/batery.png"
// import ftcheck from "../../../../public/Images/ftcheck.png"
// import host2 from "../../../../public/Images/host2.png"
// import host1 from "../../../../public/Images/host1.png"
import { Link } from 'react-router-dom';


const Pricing = () => {


  const [monthlyUsers, setMonthlyUsers] = useState(4153);
  // const [dashboardUsers, setDashboardUsers] = useState(4);
  // const [multiFactorAuth, setMultiFactorAuth] = useState(true);
  // const [accountLinking, setAccountLinking] = useState(true);
  // const minPricePerMAU = 100;
  // const pricePerMAU = monthlyUsers * 0.01 < minPricePerMAU ? minPricePerMAU : monthlyUsers * 0.01;
  // const dashboardUserCost = dashboardUsers * 20;
  
  // const totalCost = pricePerMAU + dashboardUserCost;




  return (

    <section className='PricingSec'
    style={{
      "--background-image":`url(${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/pricegrdint.png)`
    }}
    >
        <div className="container">

          {/* TransparentsFee */}
          <div className="TransparentsFee">

            <div className="KeyHeading">
              <SectionText secspan1="Transparent pricing," secblk2="no hidden fees" />
              <p>Choose a pricing plan that fits your preferred hosting option—whether you go for our fully managed cloud hosting or take control with self-hosting.</p>
            </div>

            <div className="TransparentHostDiv">

              <div className="HostPriceDiv active">

                <div className="hostinner">
                  <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/host1.png`} alt="" width={50} height={50} />
                  <h4>Cloud Hosting</h4>
                  <p>Enjoy secure, hassle-free hosting on our cloud with automatic updates, backups, and 24/7 support.</p>
                </div>

                <div className="hstinrgd">
                  <h4>$0.02 per MAU</h4>
                  <p>(Free under 5K monthly active users)</p>
                </div>

                <div className="RedBtn">
                  <Link to="#"><img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/batery.png`} alt="batery" width={18} height={18} /> Get Started</Link>
                </div>

              </div>

              <div className="HostPriceDiv">

                <div className="hostinner">
                  <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/host2.png`} alt="" width={50} height={50} />
                  <h4>Self-Hosting</h4>
                  <p>Host on your own infrastructure for complete control and customization. We&apos;ll provide setup support.</p>
                </div>

                

              </div>






            </div>

            




          </div>


          {/* Hosting plan  */}
          <div className="Hosting_Plan">
            <div className="KeyHeading">
              <SectionText secblk1="Hosting Plan" secspan2="Comparison"  />
              <p>Explore the key differences between our cloud-hosted and self-hosted plans.Choose the one that best fits your clinic&apos;s needs.</p>
            </div>
            <div className="HostingTableDiv">
              <table>
                <thead>
                  <tr>
                    <th>Features</th>
                    <th>Cloud Hosting</th>
                    <th>Self Hosting</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Setup & Maintenance</td>
                    <td>Managed by us</td>
                    <td>Managed by your team</td>
                  </tr>
                  <tr>
                    <td>Data Storage</td>
                    <td>Unlimited cloud storage</td>
                    <td>Dependent on your infrastructure</td>
                  </tr>
                  <tr>
                    <td>Security & Compliance</td>
                    <td>Fully compliant (SOC2, ISO 27001, GDPR)</td>
                    <td>You handle compliance and security</td>
                  </tr>
                  <tr>
                    <td>Automatic Updates</td>
                    <td>Included</td>
                    <td>Manual updates required</td>
                  </tr>
                  <tr>
                    <td>Backup & Recovery</td>
                    <td>Daily automatic backups</td>
                    <td>You manage backup and recovery</td>
                  </tr>
                  <tr>
                    <td>Support </td>
                    <td>24/7 priority support</td>
                    <td>Limited support</td>
                  </tr>
                  <tr>
                    <td>Uptime Guarantee</td>
                    <td>99.9% uptime SLA</td>
                    <td>Dependent on your infrastructure</td>
                  </tr>
                  <tr>
                    <td>Cost</td>
                    <td>Monthly subscription</td>
                    <td>One-time setup cost, ongoing server costs</td>
                  </tr>
                  <tr>
                    <td>Scalability</td>
                    <td>Easily scalable</td>
                    <td>Dependent on your infrastructure</td>
                  </tr>
                  <tr>
                    <td>Customizations</td>
                    <td>Limited customization</td>
                    <td>Full control over customizations</td>
                  </tr>

                </tbody>
              </table>
            </div>
          </div>

          {/* Key Fecture  */}
          <div className="Key_Features_Sec">

            <div className="KeyHeading">
              <SectionText secblk1="Key" secspan2="Features"  />
              <p>No matter which hosting option you choose, you&apos;ll always get access to our full suite of essential features designed to help you manage your veterinary practice efficiently.</p>
            </div>

            <div className="FeatureData">

              <div className="FeatureItem">
                <div className="fethed grn">
                  <h4>Authentication Options</h4>
                </div>
                <div className="fetiner">
                  <p>Email Password <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/ftcheck.png`} alt="" width={24} height={24} /></p>
                  <p>Social Logins (Google, GitHub, Facebook, and custom providers) <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/ftcheck.png`} alt="" width={24} height={24} /></p>
                  <p>Email Verification, forgot password flows <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/ftcheck.png`} alt="" width={24} height={24} /></p>
                  <p>M2M authentication <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/ftcheck.png`} alt="" width={24} height={24} /></p>
                  <p>Single Sign-On (SSO) <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/ftcheck.png`} alt="" width={24} height={24} /></p>
                </div>
              </div>

              <div className="FeatureItem">
                <div className="fethed ltblu">
                  <h4>Account Management</h4>
                </div>
                <div className="fetiner">
                  <p>Email Verification and Forgot Password flows <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/ftcheck.png`} alt="" width={24} height={24} /></p>
                  <p>Multi-Factor Authentication (MFA) <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/ftcheck.png`} alt="" width={24} height={24} /></p>
                  <p>M2M Authentication <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/ftcheck.png`} alt="" width={24} height={24} /></p>
                </div>
              </div>

              <div className="FeatureItem">
                <div className="fethed ltgry">
                  <h4>User Access Control</h4>
                </div>
                <div className="fetiner">
                  <p>Role-Based Access Control (RBAC) <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/ftcheck.png`} alt="" width={24} height={24} /></p>
                  <p>User Management Dashboard <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/ftcheck.png`} alt="" width={24} height={24} /></p>
                  <p>Session Management <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/ftcheck.png`} alt="" width={24} height={24} /></p>
                </div>
              </div>

              <div className="FeatureItem">
                <div className="fethed ltred">
                  <h4>Customization and Compliance</h4>
                </div>
                <div className="fetiner">
                  <p>Custom Hooks and Actions <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/ftcheck.png`} alt="" width={24} height={24} /></p>
                  <p>SOC2 Compliance <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/ftcheck.png`} alt="" width={24} height={24} /></p>
                  <p>Overrides <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/ftcheck.png`} alt="" width={24} height={24} /></p>
                </div>
              </div>

            </div>

          </div>



            {/* Price calculator */}
            <div className="Price_Calc_Div">
              <SectionText secblk1="Pricing" secspan2="Calculator"  />

              <div className="PriceBoxDiv mt-5">

                <div className="lftprice">

                  <div className="Price_RangeDiv">
                    <div className="pstp">
                      <h5>Number of Monthly Average Users:</h5>
                      <span>{monthlyUsers}</span>
                    </div>
                    <input type="range" min="100" max="50000" value={monthlyUsers} onChange={(e) => setMonthlyUsers(e.target.value)} 
                      style={{
                        background: `linear-gradient(110.64deg, #D04122 14.7%, #FDBD74 61.41%) no-repeat, #ddd`,
                        backgroundSize: `${(monthlyUsers - 100) / (50000 - 100) * 100}% 100%`
                      }}
                    />
                  </div>

                  <div className="MultifactorDiv">

                    <div className="Price_Option">
                      <div className="multiinput">
                        <input type="checkbox" checked/>
                        <h5>Multi-factor Authentication</h5>
                      </div>
                      <p>Price per MAU: $0.01 <br /> (Minimum $100)</p>
                    </div>

                    <div className="Price_Option">
                      <div className="multiinput">
                        <input type="checkbox" checked />
                        <h5>Account Linking</h5>
                      </div>
                      <p>Price per MAU: $0.01 <br /> (Minimum $100)</p>
                    </div>

                    <div className="Price_Option">
                      <div className="multiinput">
                        <input type="checkbox" checked/>
                        <h5>No. of Dashboard Users</h5>
                      </div>
                      <div className="mulspan">
                        <span>4</span>
                        <p>Price per User: $20</p>
                      </div>
                      
                    </div>

                  </div>

                </div>

                <div className="Rytprice">

                  <div className="PriceInner">
                    <div className="PriceText">
                      <h2><span>$204</span></h2>
                      <h5>Estimated Monthly Billing</h5>
                      <p>Free under 5K MAUs</p>
                    </div>
                    <div className="RedBtn">
                      <Link to="#"><img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/batery.png`} alt="batery" width={18} height={18} /> Get Started</Link>
                    </div>
                  </div>

                </div>

              </div>

            </div>

            {/* FAQ_DIV */}
            <div className="FAQ_DIV">
                <SectionText secspan1="Frequently Asked" secblk2="Questions" />
                <FAQ/>
            </div>

            {/* NeedHelpDiv */}
            <div className="NeedHelpDiv">
                <div className="Needhelpitem"
                style={{
                  "--pricehelp-bg": `url(${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/pricehlp.png)`,
                }}
                >
                    <div className="helpText">
                        <h3>Need Help? We’re All Ears!</h3>
                        <p>Got questions or need assistance? Just reach out! Our team is here to help.</p>
                    </div>
                    <div className="helpbtn">
                        <button> <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/heart.png`} alt="" /> Get in Touch</button>
                    </div>
                </div>
            </div>

        </div>
    </section>






  )
}

export default Pricing




SectionText.propTypes = {
    secblk1: PropTypes.string.isRequired, 
    secspan2: PropTypes.string.isRequired,                
    secblk2: PropTypes.string.isRequired, 
    secspan1: PropTypes.string.isRequired,                               
};
export function SectionText({secblk1,secspan2 ,secblk2,secspan1 }) {
    return <div className="SecHead">
        {secblk1 || secspan2 ? (
        <h2>
          {secblk1} <span>{secspan2}</span>
        </h2>
      ) : null}
      {secspan1 || secblk2 ? (
        <h2>
          <span>{secspan1}</span> {secblk2}
        </h2>
      ) : null}
    </div>
}
