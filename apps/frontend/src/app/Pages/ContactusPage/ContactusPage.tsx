"use client";
import React , {useState} from 'react'
import "./ContactusPage.css"
import Footer from '@/app/Components/Footer/Footer'
import { Container } from 'react-bootstrap'
import { FormInput } from '../Sign/SignUp'
import DynamicSelect from '@/app/Components/DynamicSelect/DynamicSelect';

function ContactusPage() {

    //emails
    const [email, setEmail] = useState("")

    // Query Type
    const [selectedQueryType, setSelectedQueryType] = useState("General Enquiry");
    const queryTypes = [
        "General Enquiry",
        "Feature Request",
        "Data Service Access Request"
    ];

    // Subrequest options for Data Service Access Request
    const [subselectedRequest, setSubSelectedRequest] = useState("");
    const subrequestOptions = [
        "The person, or the parent / guardian of the person, whose name appears above",
        "An agent authorized by the consumer to make this request on their behalf",
        
    ];

    // Data Service Access Request options
    const [selectedRequest, setSelectedRequest] = useState("");
    const requestOptions = [
        "Know what information is being collected from you",
        "Have your information deleted",
        "Opt-out of having your data sold to third-parties",
        "Opt-in to the sale of your personal data to third-parties",
        "Access your personal information",
        "Fix inaccurate information",
        "Receive a copy of your personal information",
        "Opt-out of having your data shared for cross-context behavioral advertising",
        "Limit the use and disclosure of your sensitive personal information",
        "Others (please specify in the comment box below)"
    ];

    // Areas 
    const [area, setArea] = useState<string>("");
    type Option = {
        value: string;
        label: string;
    };
    const areaOptions: Option[] = [
        { value: "south", label: "South Zone" },
        { value: "east", label: "East Zone" },
        { value: "west", label: "West Zone" },
        { value: "central", label: "Central Zone" },
        { value: "urban", label: "Urban Area" },
        { value: "rural", label: "Rural Area" },
        { value: "coastal", label: "Coastal Area" },
    ];

    // Subrequest options for Data Service Access Request
    const [ConfselectedRequest, setConfSelectedRequest] = useState("");
    const confirmOptions = [
        "Under penalty of perjury, I declare all the above information to be true and accurate.",
        "I understand that the deletion or restriction of my personal data is irreversible and may result in the termination of services with Yosemite Crew.",
        "I understand that I will be required to validate my request my email, and I may be contacted in order to complete the request.",
        
    ];


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

                    <div className="QueryText">
                        <h3>Submit <span>your query</span></h3>
                    </div>

                    {/* Contact Form */}
                    <div className="ContactForm">
                        <FormInput intype="email" inname="email"  value={email} inlabel="Full Name" onChange={(e) => setEmail(e.target.value)}/>
                        <FormInput intype="email" inname="email"  value={email} inlabel="Enter Email Address" onChange={(e) => setEmail(e.target.value)}/>
                        <FormInput intype="email" inname="email"  value={email} inlabel="Phone number (optional)" onChange={(e) => setEmail(e.target.value)}/>
                    </div>

                    {/* Radio Group */}
                    <div className='QueryTypeRadioGroup'>
                        {queryTypes.map((type) => (
                            <label key={type} >
                                <input type="radio" name="queryType" value={type}
                                    checked={selectedQueryType === type}
                                    onChange={() => setSelectedQueryType(type)} />
                                {type}
                            </label>
                        ))}
                    </div>

                    {/* Conditional rendering based on query type */}
                    {selectedQueryType !== "Data Service Access Request" ? (
                        <>
                            <div className='QueryDetailsFields'>
                                <label>Please leave details regarding your request</label>
                                <textarea  rows={3} placeholder="Your Message"></textarea>
                            </div>
                            <button style={{
                                width: "100%",
                                padding: "12px",
                                borderRadius: "24px",
                                background: "#bdbdbd",
                                color: "#fff",
                                fontWeight: 500,
                                border: "none",
                                marginTop: "12px"
                            }}>Send Message</button>
                        </>
                    ) : (
                        <div className="DataServiceAccessFields">

                            <div className="SetSubmitted">
                                <p>You are submitting this request as</p>
                                {subrequestOptions.map((option, index) => (
                                    <label key={index}>
                                    <input type="radio" name="requestType" value={option} checked={subselectedRequest === option}
                                        onChange={() => setSubSelectedRequest(option)}/>
                                        {option}
                                    </label>
                                ))}
                            </div>

                            <div className="SetSubmitted">
                                <p>Under the rights of which law are you making this request?</p>
                                <DynamicSelect options={areaOptions} value={area} onChange={setArea} inname="area" placeholder="Select one"/>
                            </div>

                            <div className="SetSubmitted">
                                <p>You are submitting this request to</p>
                                {requestOptions.map((option, index) => (
                                    <label key={index}>
                                    <input
                                        type="radio"
                                        name="requestType"
                                        value={option}
                                        checked={selectedRequest === option}
                                        onChange={() => setSelectedRequest(option)}
                                    />
                                    {option}
                                    
                                    </label>
                                ))}
                            </div>

                            <div className='QueryDetailsFields'>
                                <label>Please leave details regarding your action request or question</label>
                                <textarea rows={3} placeholder="Your Message"></textarea>
                            </div>

                            <div className="SetSubmitted">
                                <p>I confirm that</p>
                                {confirmOptions.map((option, index) => (
                                    <label key={index}>
                                    <input
                                        type="checkbox"
                                        name="ConfType"
                                        value={option}
                                        checked={ConfselectedRequest === option}
                                        onChange={() => setConfSelectedRequest(option)}
                                    />
                                    {option}
                                    
                                    </label>
                                ))}
                            </div>

                            <button style={{
                                width: "100%",
                                padding: "12px",
                                borderRadius: "24px",
                                background: "#bdbdbd",
                                color: "#fff",
                                fontWeight: 500,
                                border: "none",
                                marginTop: "12px"
                            }}>Send Message</button>
                        </div>
                    )}

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