// eslint-disable-next-line no-unused-vars
import React, { useRef } from "react";
import "./Homepage.css";
import PropTypes from "prop-types";
import heroImg from "../../../../public/Images/Homepage/Heroimg.png";
import P1 from "../../../../public/Images/Homepage/P1.png";
import P2 from "../../../../public/Images/Homepage/P2.png";
import P3 from "../../../../public/Images/Homepage/P3.png";
import P4 from "../../../../public/Images/Homepage/P4.png";
import Pr1 from "../../../../public/Images/Homepage/Pr1.png";
import Pr2 from "../../../../public/Images/Homepage/Pr2.png";
import Pr3 from "../../../../public/Images/Homepage/Pr3.png";
import Pr4 from "../../../../public/Images/Homepage/Pr4.png";
import Pr5 from "../../../../public/Images/Homepage/Pr5.png";
import Pr6 from "../../../../public/Images/Homepage/Pr6.png";
import Pr7 from "../../../../public/Images/Homepage/Pr7.png";
import Pr8 from "../../../../public/Images/Homepage/Pr8.png";
import Betimg from "../../../../public/Images/Homepage/betterimg.png";
import CR1 from "../../../../public/Images/Homepage/cr1.png";
import CR2 from "../../../../public/Images/Homepage/cr2.png";
import CR3 from "../../../../public/Images/Homepage/cr3.png";
import exprt1 from "../../../../public/Images/Homepage/exprt1.png";
import exprt2 from "../../../../public/Images/Homepage/exprt2.png";
import exprt3 from "../../../../public/Images/Homepage/exprt3.png";
import focus1 from "../../../../public/Images/Homepage/focus1.png";
import focus2 from "../../../../public/Images/Homepage/focus2.png";
import focus3 from "../../../../public/Images/Homepage/focus3.png";
import focus4 from "../../../../public/Images/Homepage/focus4.png";
import focus5 from "../../../../public/Images/Homepage/focus5.png";
import { SectionText } from "../Pricing/Pricing";
import { Link } from "react-router-dom";
// import useHover3d from '../../utils/hover';

const Homepage = () => {
  // // animate banner
  //     const ref = useRef(null);
  //     const { transform, transition } = useHover3d(ref, {
  //         x: 45, // Increased rotation
  //         y: -20, // Dynamic movement
  //         z: 70, // Stronger perspective
  //     });
  // // animate banner

  return (

      <div className="HomeMain">
        {/* HeroSection */}
        <section className="HeroSection">
          <div className="container">
            <div className="HeroData">
              <div className="LeftHeroDiv">
                <div className="herotext">
                  <h1 className="type first">Helping You Help Pets,</h1>
                  <h1>
                    <span className="type second">Without the Hassle</span>
                  </h1>
                </div>
                <div className="heroPara">
                  <div className="paraitem">
                    <p>
                      <img src={P1} alt="Hero" /> Open source, cloud-based
                      system
                    </p>
                  </div>
                  <div className="paraitem">
                    <p>
                      <img src={P2} alt="Hero" /> Enhance your daily workflow
                    </p>
                  </div>
                  <div className="paraitem">
                    <p>
                      <img src={P3} alt="Hero" /> Easy-to-use, time-saving
                      features
                    </p>
                  </div>
                  <div className="paraitem">
                    <p>
                      <img src={P4} alt="Hero" /> Access data anytime, anywhere
                    </p>
                  </div>
                </div>
                <div className="HeroBtn">
                  <Link className="Fillbtn" to="/signup">
                    <i className="ri-flashlight-fill"></i> Get Started
                  </Link>
                  <Link className="Sbtn" to="/contact">
                    <i className="ri-time-fill"></i> Book a Demo
                  </Link>
                </div>
              </div>
              <div className="RytHeroDiv">
                <img src={heroImg} alt="Hero" />
              </div>
            </div>
          </div>
        </section>

        {/* PracticeSection */}
        <section className="PracticeSection">
          <div className="container">
            <HeadLine
              spnhead="Everything You Need"
              blkhead="to Run Your Practice"
            />

            <div className="Practice_Box_Data">
              <BoxPract
                Bpimg={Pr1}
                BpTxt1="Appointment"
                BpTxt2="Scheduling"
                BpPara="Easily manage bookings, cancellations, and reminders to minimize no-shows."
              />
              <BoxPract
                Bpimg={Pr2}
                BpTxt1="Medical Records"
                BpTxt2="Management"
                BpPara="Organize patient data, treatment history, and prescriptions in one secure platform."
              />
              <BoxPract
                Bpimg={Pr3}
                BpTxt1="Client"
                BpTxt2="Communication"
                BpPara="Send automated reminders, updates, and follow-up messages via email or text."
              />
              <BoxPract
                Bpimg={Pr4}
                BpTxt1="Billing &"
                BpTxt2="Payments"
                BpPara="Generate invoices, process payments, and track financials with ease."
              />
              <BoxPract
                Bpimg={Pr5}
                BpTxt1="Invoicing"
                BpTxt2="Management"
                BpPara="Automate check-out with invoicing, quick payments, downpayments, split payments, and refunds."
              />
              <BoxPract
                Bpimg={Pr6}
                BpTxt1="Pet Parent"
                BpTxt2="App"
                BpPara="Give clients a vet-in-your-pocket with a dedicated app for reminders, medical records, and invoices—all in one."
              />
              <BoxPract
                Bpimg={Pr7}
                BpTxt1="Report &"
                BpTxt2="Analytics"
                BpPara="Monitor practice performance with detailed insights into appointments, revenue, and client retention."
              />
              <BoxPract
                Bpimg={Pr8}
                BpTxt1="Inventory"
                BpTxt2="Management"
                BpPara="Keep track of stock levels, place orders, and receive notifications when supplies are low."
              />
            </div>
          </div>
        </section>

        {/* FocusSection */}
        <section className="FocusSection">
          <div className="container">
            <div className="foctext">
              <SectionText secspan1="Focus on Care," secblk2="Not Admin" />
              <p>
                The easy-to-use, cloud-based software that simplifies practice
                management and elevates patient care.
              </p>
            </div>

            <div className="Focus_data">
              <FocusCard
                Focimg={focus1}
                focname="API-Driven"
                focpara="Seamlessly integrate with external tools and systems, offering flexible data sharing and connectivity."
              />
              <FocusCard
                focadcls="purplecard"
                Focimg={focus2}
                focname="Open Source"
                focpara="With Yosemite Crew’s GPL license, you own the software—SaaS simplicity with Open Source freedom and no vendor lock-in."
              />
              <FocusCard
                focadcls="browncard"
                Focimg={focus3}
                focname="Automated Workflows"
                focpara="Automate invoicing, appointment scheduling, and reminders, freeing up your team to focus on what matters most."
              />
              <FocusCard
                focadcls="greencard"
                Focimg={focus4}
                focname="Secure & Compliant"
                focpara="Built with GDPR, SOC2, and ISO 27001 compliance, ensuring the highest standards of security and trust."
              />
              <FocusCard
                focadcls="blckcard"
                Focimg={focus5}
                focname="Scalable"
                focpara="Grow with confidence – whether you're a small clinic or a multi-location practice, our software evolves with your needs."
              />
            </div>
          </div>
        </section>

        {/* TrustExpert  */}
        <section className="TrustExpertSec">
          <div className="container">
            <SectionText secspan1="Trusted" secblk2="by Veterinary Experts" />

            <div className="TrustExpertData">
              <div className="Expertitems">
                <div className="expertPara">
                  <p>
                    Yosemite Crew has transformed the way we manage our clinic.
                    The open-source platform allows us to customize it to our
                    needs, and the automated workflows save us hours every week!
                  </p>
                </div>
                <div className="expertBio">
                  <img src={exprt1} alt="" />
                  <div className="exprtName">
                    <h6>Dr. Sarah Mitchell</h6>
                    <p>
                      Senior Veterinarian <br /> Paws & Claws Animal Hospital
                    </p>
                  </div>
                </div>
              </div>

              <div className="Expertitems purpleitem">
                <div className="expertPara">
                  <p>
                    Our team is more efficient, and our clients love the mobile
                    app. It’s made communication so much easier, and patient
                    care is more organized than ever.t
                  </p>
                </div>
                <div className="expertBio purplebio">
                  <img src={exprt2} alt="" />
                  <div className="exprtName">
                    <h6>Dr. Michael Lawson</h6>
                    <p>
                      Director <br /> Healthy Paws Veterinary Center
                    </p>
                  </div>
                </div>
              </div>

              <div className="Expertitems greenitem">
                <div className="expertPara">
                  <p>
                    Switching to Yosemite Crew was the best decision for our
                    practice. The integration with third-party tools and
                    real-time analytics have given us incredible insights into
                    how to improve our operations.
                  </p>
                </div>
                <div className="expertBio greenbio">
                  <img src={exprt3} alt="" />
                  <div className="exprtName">
                    <h6>Dr. Emily Carter</h6>
                    <p>
                      Clinic Manager <br /> Furry Friends Veterinary Clinic
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* WhoCareSec */}
        <section className="WhoCareSec">
          <div className="container">
            <div className="whocareData">
              <div className="lftcare">
                <HeadLine
                  spnhead="Caring for the Vets"
                  blkhead="Who Care for Pets"
                />
                <p>
                  We prioritize your data security and compliance with
                  industry-leading standards. Our platform is fully compliant
                  with:
                </p>
              </div>
              <div className="rytcare">
                <p>Our platform is fully compliant with:</p>
                <div className="carelog">
                  <img src={CR1} alt="" width={109} height={112} />
                  <img src={CR2} alt="" width={261} height={196} />
                  <img src={CR3} alt="" width={194} height={137} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BettercareSec */}
        <section className="BettercareSec">
          <div className="container">
            <div className="BettercareBox">
              <div className="lftbetter">
                <div className="betInner">
                  <h2>
                    <span>Better Care</span> is just a <br /> click away
                  </h2>
                  <p>
                    Join hundreds of veterinary clinics already enhancing
                    patient care and streamlining their workflow.
                  </p>
                  <FillBtn
                    FilName="Book a Demo"
                    FilIcon="ri-flashlight-fill "
                    Filhref="#"
                  />
                  {/* <a className='Fillbtn' href="#"><i className="ri-flashlight-fill"></i> Book a Demo</a> */}
                </div>
              </div>
              <div className="lftbetter">
                <img src={Betimg} alt="" />
              </div>
            </div>
          </div>
        </section>
      </div>

  );
};

export default Homepage;

// FocusCard
FocusCard.propTypes = {
  Focimg: PropTypes.string.isRequired,
  focname: PropTypes.string.isRequired,
  focpara: PropTypes.string.isRequired,
  focadcls: PropTypes.string.isRequired,
};
function FocusCard({ Focimg, focname, focpara, focadcls }) {
  return (
    <div className={`FocusItem ${focadcls}`}>
      <img src={Focimg} alt="" width={100} height={100} />
      <div className="focusText">
        <h4>{focname}</h4>
        <p>{focpara}</p>
      </div>
    </div>
  );
}

// HeadLine
HeadLine.propTypes = {
  spnhead: PropTypes.string.isRequired,
  blkhead: PropTypes.string.isRequired,
};
function HeadLine({ spnhead, blkhead }) {
  return (
    <div className="SecHeading">
      <h2>
        <span>{spnhead}</span> <br /> {blkhead}{" "}
      </h2>
    </div>
  );
}

// Fill Btn
FillBtn.propTypes = {
  FilName: PropTypes.string.isRequired,
  FilIcon: PropTypes.string.isRequired,
  Filhref: PropTypes.string.isRequired,
};
export function FillBtn({ FilName, FilIcon, Filhref }) {
  return (
    <Link className="Fillbtn" to={Filhref}>
      <i className={FilIcon}></i> {FilName}
    </Link>
  );
}

// BoxPract
BoxPract.propTypes = {
  Bpimg: PropTypes.string.isRequired,
  BpTxt1: PropTypes.string.isRequired,
  BpTxt2: PropTypes.string.isRequired,
  BpPara: PropTypes.string.isRequired,
};
function BoxPract({ Bpimg, BpTxt1, BpTxt2, BpPara }) {
  return (
    <div className="PracBox">
      <img src={Bpimg} alt="" />
      <h4>
        {BpTxt1} <br /> {BpTxt2}
      </h4>
      <p>{BpPara}</p>
    </div>
  );
}
