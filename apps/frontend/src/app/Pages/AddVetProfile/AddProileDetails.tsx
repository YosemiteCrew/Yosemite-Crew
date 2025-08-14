"use client";
import React, { useState } from "react";
import "./AddVetProfile.css"
import { Button, Col, Container, Dropdown, Form, Row } from 'react-bootstrap'
import { Icon } from '@iconify/react/dist/iconify.js'
import Image from 'next/image'
import Link from "next/link";

type Member = {
    img: string;
    name: string;
    role: string;
};

function AddProileDetails() {

    // personalDetails
    const [personalDetails, setPersonalDetails] = useState({
        rcvsNumber: "ABC000000",
        sex: "Male",
        emailAddress: "adamsbrown82@gmail.com",
        dob: "09-03-1982",
        phoneNumber: "+1-6793532903",
        postalCode: "000000",
        address: "165, ANC Apartments D-block SRM Street 5",
        area: "Queens Road",
        city: "London",
        StateProvince: "London",
    });

    // professionalDetails
    const [professionalDetails, setProfessionalDetails] = useState({
        linkedin: "http://linkedin/profile/1adambownpc/day",
        medicalLicense: "ABC00000000000000",
        experience: "18 Years",
        specialisation: "Heart Surgery",
        qualification:
        "Bachelor of Medicine, Bachelor of Surgery (MBBS), general medical experience, Fellowship of the Royal College of Surgeons (FRCS)",
        bio: "Veterinary AI Leader | Clinical Data & AI Strategist | Equine Internal Medicine Specialist | Startup Advisor | Researcher | Speaker | Educator",
    });

    // orgRecord
    const [orgRecord] = useState({
        idNumber: "ASG469271200",
        emailAddress: "adambrown@sfamedi.com",
        yearsOfWorking: "02 Years",
        joiningDate: "Jan 10, 2025",
    });

    
    const [editMode, setEditMode] = useState<"personal" | "professional" | null>(null);

    const handleChange = (section:any, field:any, value:any) => {
        if (section === "personal") {
        setPersonalDetails({ ...personalDetails, [field]: value });
        } else if (section === "professional") {
        setProfessionalDetails({ ...professionalDetails, [field]: value });
        }
    };


    // Members Profile Dropdown Started 

    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [members] = useState<Member[]>([
        {
        img: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?q=80&w=687&auto=format&fit=crop",
        name: "Dr. Laura Evans",
        role: "Internal Medicine",
        },
        {
        img: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?q=80&w=687&auto=format&fit=crop",
        name: "Dr. Emily Foster",
        role: "Internal Medicine",
        },
        {
        img: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?q=80&w=687&auto=format&fit=crop",
        name: "Dr. Sarah Thompson",
        role: "Vet Technician",
        },
        {
        img: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?q=80&w=687&auto=format&fit=crop",
        name: "Jessica Collins",
        role: "Nurse",
        },
    ]);

    const handleSelect = (eventKey: string | null, _e: React.SyntheticEvent<unknown>) => {
        if (eventKey !== null) {
        const member = members[parseInt(eventKey, 10)];
        setSelectedMember(member);
        }
    };
 // Members Profile Dropdown Ended




  return (
    <>


    <section className='AddProfileDetailSec'>
        <Container>
            <div className="AddProfileDetailData">

                <BackBtn href="" icon="solar:round-alt-arrow-left-outline" backtext="Back"/>

                <div className="ProfileDetails">
                    <div className="LeftProp">
                        <Image src="https://images.unsplash.com/photo-1582750433449-648ed127bb54?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Preview"  width={80} height={80}/>
                        <div className="proptext">
                            <h4>Adam Brown</h4>
                            <p>Technician/Internal Medicine</p>
                        </div>
                    </div>
                    <div className="RytProp">
                        <p>🎉 Your profile is verified and good to go — no new appointments.</p>  
                    </div>
                </div>

                <Row>
                    <Col md={8}>
                        <div className="detail-card">
                            <div className="card-header">
                                <h5>Personal Details</h5>
                                <Button
                                    variant="link"
                                    onClick={() =>
                                    setEditMode(editMode === "personal" ? null : "personal")
                                    }
                                >
                                    {editMode === "personal" ? (
                                        <>
                                            <Icon icon="carbon:checkmark-filled" width={18} height={18} />
                                            Update Profile
                                        </>
                                        ) : (
                                        <>
                                            <Icon icon="solar:pen-bold" width={14} height={14} />
                                            Edit Profile
                                        </>
                                    )} 
                                </Button>
                            </div>
                            <div className="card-body">
                                {Object.entries(personalDetails).map(([key, value]) => (
                                    <div className="detail-row" key={key}>
                                        <h6>{key.replace(/([A-Z])/g, " $1")}: </h6>
                                        {editMode === "personal" ? (
                                            <Form.Control value={value} onChange={(e) =>
                                            handleChange("personal", key, e.target.value)} />
                                        ) : (
                                            <p>{value}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Col>
                    <Col md={4}>
                        <div className="OrganistRecord">
                            <h5>Your Organisation Record</h5>
                            {Object.entries(orgRecord).map(([key, value]) => (
                            <div className="detail-row" key={key}>
                                <h6>{key.replace(/([A-Z])/g, " $1")}: </h6> <p>{value}</p>
                            </div>
                            ))}
                        </div>
                    </Col>
                </Row>
                <Row>
                    <Col md={8}>
                        <div className="detail-card">
                            <div className="card-header">
                            <h5>Professional Details</h5>
                            <Button
                                variant="link"
                                onClick={() =>
                                setEditMode(
                                    editMode === "professional" ? null : "professional"
                                )
                                }
                            >
                                {editMode === "professional" ? (
                                    <>
                                        <Icon icon="carbon:checkmark-filled" width={18} height={18} />
                                        Update Profile
                                    </>
                                    ) : (
                                    <>
                                        <Icon icon="solar:pen-bold" width={14} height={14} />
                                        Edit Profile
                                    </>
                                )}
                                
                            </Button>
                            </div>
                            <div className="Profbody">
                            {Object.entries(professionalDetails).map(([key, value]) => (
                                <div className="detail-row" key={key}>
                                <h6>{key.replace(/([A-Z])/g, " $1")}: </h6>
                                {editMode === "professional" ? (
                                    <Form.Control
                                    size="sm"
                                    value={value}
                                    onChange={(e) =>
                                        handleChange("professional", key, e.target.value)
                                    }
                                    />
                                ) : (
                                    <p>{value}</p>
                                )}
                                </div>
                            ))}
                            </div>
                        </div>
                    </Col>
                    <Col md={4}>
                         <Dropdown onSelect={handleSelect} className="members-dropdown">
                            <Dropdown.Toggle className="custom-dropdown-toggle">
                                {selectedMember ? (
                                <div className="member-item">
                                    
                                    <div>
                                    <h6>{selectedMember.name}</h6>
                                    {/* Removed role from toggle */}
                                    </div>
                                </div>
                                ) : (
                                "Members Profile"
                                )}
                            </Dropdown.Toggle>

                            <Dropdown.Menu className="custom-dropdown-menu">
                                {members.map((m, i) => (
                                <Dropdown.Item key={i} eventKey={i.toString()} className="member-item">
                                    <Image src={m.img} alt={m.name} width={40} height={40} />
                                    <div>
                                    <h6>{m.name}</h6>
                                    <p>{m.role}</p>
                                    </div>
                                </Dropdown.Item>
                                ))}
                            </Dropdown.Menu>
                        </Dropdown>
                    </Col>
                </Row>
            </div>
        </Container>
    </section>
    </>
  )
}

export default AddProileDetails


type BackBtnProps = {
  href: string;
  icon: string;
  backtext: string;
};

export function BackBtn({ href, icon, backtext }: BackBtnProps) {
  return (
    <Link href={href} className="BackBtn">
      <Icon icon={icon} width="22" height="22" /> {backtext}
    </Link>
  );
}

