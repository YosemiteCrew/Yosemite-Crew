
import React, { useState } from 'react'
import "./Contact_us.css"
import PropTypes from 'prop-types';
import { MainBtn } from '../Appointment/page';
import { Forminput } from '../SignUp/SignUp';
import { FormArea } from '../Add_Prescription/Add_Prescription';


const Contact_us = () => {

    
  // DropeDown Services 
  
  const servicesList = [
    { id: 1, name: '24/7 Emergency Care' },
    { id: 2, name: 'Surgery and Operating Rooms' },
    { id: 3, name: 'Veterinary ICU' },
    { id: 4, name: 'Dental Care Services' },
    { id: 5, name: 'Behavioral Therapy' },
  ];
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServices, setSelectedServices] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
  };
  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };
  const handleSelectService = (id) => {
    setSelectedServices((prevSelected) =>
      prevSelected.includes(id)
        ? prevSelected.filter((serviceId) => serviceId !== id)
        : [...prevSelected, id]
    );
  };
  const filteredServices = servicesList.filter((service) =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  
  return (
    <>

    <section className='ContactUs_Sec'>
        <div className="container">
            <div className="ContatHeroData">
                <div className="leftCont">
                    <p className='ContName'>Contact us</p>
                    <h1>Need Help? <br /> We’re All Ears!</h1>
                </div>
                <div className="RytCont">
                    <FormHead frspan="Submit" frtext="your query" />
                    <div className="">
                        <Forminput inlabel="Full Name" intype="name" inname="name"/>
                        <Forminput inlabel="Email Address" intype="email" inname="email"/>
                        <Forminput inlabel="Phone number (optional)" intype="number" inname="number"/>
                    </div>
                    <div className="EnquiryDiv">
                        <RadioInpt radlbl="General Enquiry" />
                        <RadioInpt radlbl="General Enquiry" />
                        <RadioInpt radlbl="General Enquiry" />
                    </div>
                    <div className="SubmitDiv">
                        <h3>You are submitting this request as</h3>
                        <RadioInpt radlbl="The person, or the parent / guardian of the person, whose name appears above" />
                        <RadioInpt radlbl="An agent authorized by the consumer to make this request on their behalf" />
                    </div>
                    <div className="services_dropdown">
                        <div className={`ServHeadr ${isDropdownOpen ? 'open' : ''}`} onClick={toggleDropdown}>
                            <span>Add Services</span>
                            <span className="arrow">{isDropdownOpen ? '▲' : '▼'}</span>
                        </div>
                        {isDropdownOpen && (
                        <div className="ServDropcontent">
                            <div className="serchbtn">
                                <i className="ri-search-line"></i>
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="Search"
                                    value={searchTerm}
                                    onChange={handleSearch}
                                />
                            </div>
                            <ul className="services-list">
                                {filteredServices.map((service) => (
                                <li
                                key={service.id}
                                className={`service-item ${selectedServices.includes(service.id) ? 'selected' : ''}`}
                                >
                                <label>
                                    <input
                                    type="checkbox"
                                    checked={selectedServices.includes(service.id)}
                                    onChange={() => handleSelectService(service.id)}
                                    />
                                    <p>{service.name}</p>
                                </label>
                                </li>
                                ))}
                            </ul>
                        </div>
                        )}
                    </div>
                    <div className="SubmitDiv">
                        <h3>You are submitting this request to</h3>
                        <RadioInpt radlbl="Know what information is being collected from you" />
                        <RadioInpt radlbl="Have your information deleted" />
                        <RadioInpt radlbl="Opt-out of having your data sold to third-parties" />
                        <RadioInpt radlbl="Opt-in to the sale of your personal data to third-parties" />
                        <RadioInpt radlbl="Access your personal information" />
                        <RadioInpt radlbl="Fix inaccurate information" />
                        <RadioInpt radlbl="Receive a copy of your personal information" />
                        <RadioInpt radlbl="Opt-out of having your data shared for cross-context behavioral advertising" />
                        <RadioInpt radlbl="Limit the use and disclosure of your sensitive personal information" />
                        <RadioInpt radlbl="Others (please specifiy in the comment box below)" />
                    </div>
                    <FormArea lablarea="Please leave details regarding your action request or question" areaplace='Your Message' Arearow="4" formcls="mb-3"/>
                    <div className="SubmitDiv">
                        <h3>I confirm that</h3>
                        <RadioInpt radlbl="Under penalty of perjury, I declare all the above information to be true and accurate." />
                        <RadioInpt radlbl="I understand that the deletion or restriction of my personal data is irreversible and may result in the termination of services with Yosemite Crew." />
                        <RadioInpt radlbl="I understand that I will be required to validate my request my email, and I may be contacted in order to complete the request." />
                    </div>
                    <MainBtn bimg="" btext="Send Message" optclas="opt" />
                </div>
            </div>
        </div>
    </section>

    <section className='Contact_Info'
    style={{
        "--background-image":`url(${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/contactbg.png)`
    }}
    >
        <div className="container">
            <div className="ContInfoData">
                <div className="lftinfo">
                    <p className='ContName'>Contact Info</p>
                    <h2>We are happy to <br /> assist you</h2>
                </div>
                <div className="Rytinfo">
                    <div className="ContInfoDiv">
                        <h6>Email Address</h6>
                        <a href="mailto:help@yosemitecrew.com">help@yosemitecrew.com</a>
                        <p>Assistance hours: <br />Monday - Friday 6 am  <br />to 8 pm EST</p>
                    </div>
                    <div className="ContInfoDiv">
                        <h6>Phone</h6>
                        <a href="tel:(808) 998-34256">(808) 998-34256</a>
                        <p>Assistance hours: <br />Monday - Friday 6 am  <br />to 8 pm EST</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    </>
  )
}


export default Contact_us


// FormHead
FormHead.propTypes = {
    frspan: PropTypes.string.isRequired, 
    frtext: PropTypes.string.isRequired,                
  };

export function FormHead({frspan,frtext}) {
    return <div className="frmhead">
        <h3><span>{frspan}</span> {frtext}</h3>
    </div>
}

// RadioInpt
RadioInpt.propTypes = {
    radlbl: PropTypes.string.isRequired            
  };
function RadioInpt({radlbl}) {
    return <div className="radiodiv">
        <input
            type="radio"
            name="emergencyServices"
            value="No"
            id="emergencyServices1" />
        <label htmlFor="emergencyServices" className="radio-label">{radlbl}</label>
    </div>;
}