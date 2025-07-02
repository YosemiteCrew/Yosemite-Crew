'use client';
import React, { useState ,useMemo ,useCallback } from 'react';
import "./Departments.css"
import Header from '@/app/Components/Header/Header';
import ProfileProgressbar from '@/app/Components/ProfileProgressbar/ProfileProgressbar';
import { Container, FloatingLabel, Form } from 'react-bootstrap';
import { FormInput } from '../Sign/SignUp';
import { PhoneInput } from '@/app/Components/PhoneInput/PhoneInput';
import { IoMdArrowDropdown, IoMdArrowDropup } from 'react-icons/io';
import { HeadText } from '../CompleteProfile/CompleteProfile';


const servicesList = [
  { code: "E001", display: "Internal Medicine" },
  { code: "S001", display: "24/7 Emergency Care" },
  { code: "V001", display: "Surgery and Operating Rooms" },
  { code: "D001", display: "Parasitology" },
  { code: "B001", display: "Dental Clinic" },
];

function AddDepartments() {
    const [isLoggedIn] = useState(true);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false); //DepartServices
    const [searchTerm, setSearchTerm] = useState("");//DepartServices
    const [selectedServices, setSelectedServices] = useState<string[]>([]);//DepartServices
    const [progress] = useState(0);
    const [name, setName] = useState({ 
      name: "",
      email: "",
      
      });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setName({ ...name, [e.target.name]: e.target.value });
    };

      // Add state for phone and country code
      const [countryCode, setCountryCode] = useState("+91");
      const [phone, setPhone] = useState("");


      // Depart Services Started
        const toggleDropdown = () => {
          setIsDropdownOpen(!isDropdownOpen);
        };
        const filteredServices = useMemo(() =>
          servicesList.filter((service) =>
            service.display.toLowerCase().includes(searchTerm.toLowerCase())
          ), [searchTerm]
        ); 
        const handleSearch = (event: { target: { value: React.SetStateAction<string>; }; }) => {
          setSearchTerm(event.target.value);
        };
        const handleSelectService = useCallback((service: { code: string; display: string }) => {
          setSelectedServices((prevSelected) => {
            const isSelected = prevSelected.includes(service.display);
            return isSelected
              ? prevSelected.filter((s) => s !== service.display)
              : [...prevSelected, service.display];
          });
        }, []);
      // Depart Services Ended  

  return (
    <>
    <Header isLoggedIn={isLoggedIn} />
    <section className='AddSpecialitiesSec'>
      <Container>

        <div className="mb-3">
          <HeadText blktext="Add" Spntext="Specialities" />
        </div>

        <div className="Add_Profile_Data">
          <div className="LeftProfileDiv">
            <div className="DepartMantAddData">

            

              <div className='DepartInputDiv'>
                <FormInput intype="text" inname="name"  value={name.name} inlabel="Department Name" onChange={handleChange}/>
                <div className="DepartFormTexediv">
                    <FloatingLabel className="textarealabl" controlId="floatingTextarea2" label="Biography/Short Description">
                        <Form.Control
                        as="textarea"
                        placeholder="Leave a comment here"
                        style={{ height: '100px' }}
                        />
                    </FloatingLabel>
                </div>
                <FormInput intype="email" inname="email"  value={name.email} inlabel="Email Address" onChange={handleChange}/>
                <PhoneInput countryCode={countryCode}  onCountryCodeChange={setCountryCode} phone={phone} onPhoneChange={setPhone}/>
              </div>

              <div className="DepartServices">
                <div className="services_dropdown">
                    <div className={`ServHeadr ${isDropdownOpen ? "open" : ""}`} onClick={toggleDropdown}>
                      <span>Add Services</span>
                      <span className="arrow">
                        {isDropdownOpen ? <IoMdArrowDropup /> : <IoMdArrowDropdown />}
                      </span>
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
                              key={service.code}
                              className={`service-item ${selectedServices.includes(service.display) ? "selected" : ""}`}
                            >
                              <label>
                                <p>{service.display}</p>
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={selectedServices.includes(service.display)}
                                  onChange={() => handleSelectService(service)}
                                />
                              </label>
                            </li>
                          ))}
                        </ul>

                      </div>
                    )}
                </div>
              </div>







            </div>

          </div>
          <div className="RytProfileDiv">
            <ProfileProgressbar
              blname="Profile"
              spname="Progress"
              progres={progress}
            />
          </div>

        </div>



      </Container>
    </section>
    




    </>
  )
}

export default AddDepartments