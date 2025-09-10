import React from 'react'
import "./PetProfile.css"
import { Button, Container } from 'react-bootstrap'
import Image from 'next/image'
import CommonTabs from '@/app/Components/CommonTabs/CommonTabs';
import { medicalrecord,  UpcomingConst } from './const';
import PetClientTable from '@/app/Components/DataTable/PetClientTable';
import { Icon } from '@iconify/react/dist/iconify.js';
import ChatApp from '../../ChatApp/ChatApp';
import MobChatApp from '@/app/Components/MobChatApp/MobChatApp';

function PetProfile() {

    const formItems = [
        { label: "Age", value: "3 Years" },
        { label: "DOB", value: "March 07, 2022" },
        { label: "Sex", value: "Female" },
        { label: "Weight", value: "28 Lbs" },
        { label: "Color", value: "Brown, Black, White" },
        { label: "Blood Group", value: "DEA 4" },
        { label: "Neutering", value: "Not Neutered" },
        { label: "Vaccination Status", value: "Up-to-date" },
        { label: "Pet ID", value: "A1B2C3D4" },
        { label: "Microchip Number", value: "11223344556677" },
    ];

    // Health Summary Data
    const healthSummary = [
      { label: "Chronic Conditions", value: "Early-stage Chronic Kidney Disease (CKD)" },
      { label: "Current Medications", value: [
        "Benazepril (5mg) — once daily",
        "Omega-3 Fatty Acid Supplement — once daily"
      ] },
      { label: "Behavior Status", value: "Calm, Mild Anxiety during vet visits" },
      { label: "Allergies", value: "Allergic to chicken protein" },
      { label: "Diet Instructions", value: "Prescription Renal Support Diet (wet food preferred)" },
      { label: "Exercise Recommendation", value: "30 minutes of low-impact walking daily" }
    ];

    const petparentsItems = [
        { label: "Name", value: "Sky Brown" },
        { label: "Phone Number", value: "63469271200" },
        { label: "Email Address", value: "skybrown@gamil.com" },
        { label: "Address", value: "6391 Elgin St. Celina, Delaware 10299" },
        { label: "Insurance Number", value: "ABC00000000000" },
        { label: "Client ID", value: "10195654" },
        { label: "Registration Date", value: "Jan 10, 2025" }
    ];


  return (
    <>
        <section className='PetProfileSec'>
            <Container>
                <div className="PetProfileData">

                    <div className="LeftPetProfile">
                        {/* PetBasicDiv Started  */}
                        <div className="PetBasicDiv">
                            <div className="BasicProfile">
                                <div className="ProfilePic">
                                    <Image src="https://d2il6osz49gpup.cloudfront.net/Images/pet.jpg" alt="profile" width={100} height={100} />
                                    <div className="pfname">
                                        <h2>Kizie</h2>
                                        <h6>Beagle</h6>
                                    </div>
                                </div>
                                <div className="ProfTeams">
                                    <div className="ProfilePic">
                                        <Image src="https://d2il6osz49gpup.cloudfront.net/Images/pet.jpg" alt="profile" width={40} height={40} />
                                        <div className="pfname">
                                            <h4>Sky Bown </h4>
                                            <p>skybrown@gamil.com</p>
                                        </div>
                                    </div>
                                    <div className="ProfilePic">
                                        <Image src="https://d2il6osz49gpup.cloudfront.net/Images/pet.jpg" alt="profile" width={40} height={40} />
                                        <div className="pfname">
                                            <h4>Laily Bown </h4>
                                            <p>laIlybrown@gamil.com</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="BasicInfoDiv">
                                <h6>Basic Details</h6>
                                <div className="BasicinfoForm">
                                    {formItems.map((item, idx) => (
                                    <div className="FormItems" key={idx}>
                                        <p>{item.label}:</p>
                                        <h6>{item.value}</h6>
                                    </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Health Summary Section */}
                        <div className="PetHealthSumy">
                            <h4>Health Summary</h4>
                            {healthSummary.map((row, idx) => (
                              <div key={idx} className='HealthSummryItem'>
                                <p>{row.label}:</p>
                                <h6>
                                  {Array.isArray(row.value) ? (
                                    <ul style={{margin:0, paddingLeft:20}}>
                                      {row.value.map((v, i) => (
                                        <li key={i} style={{marginBottom:4}}>{v}</li>
                                      ))}
                                    </ul>
                                  ) : row.value}
                                </h6>
                              </div>
                            ))}
                        </div>

                        {/* UpcommingConsultDiv Section */}
                        <div className="UpcommingConsultDiv">
                            <h4>Upcoming Consultations</h4>
                            <CommonTabs  tabs={UpcomingConst}  />
                        </div>
                        <div className="UpcommingConsultDiv">
                            <h4>Medical Record</h4>
                            <CommonTabs  tabs={medicalrecord}  />
                        </div>
                        <div className="UpcommingConsultDiv">
                            <h4>Client Statement</h4>
                            <PetClientTable/>
                        </div>

                    </div>

                    <div className="RightPetProfile">
                        <div className="PetParentsDetailsDiv">
                            <h5>Pet Parent Details</h5>
                            <div className="petparentsItems">
                                {petparentsItems.map((item, idx) => (
                                    <div className="FormItems" key={idx}>
                                        <p>{item.label}:</p>
                                        <h6>{item.value}</h6>
                                    </div>
                                ))}
                                <div className="PetparentBtn">
                                    <Button><Icon icon="solar:chat-round-line-bold" width="14" height="14" /> Message Pet Parent</Button>
                                </div>
                            </div>
                        </div>
                        <MobChatApp/>
                    </div>
                </div>
            </Container>
        </section>
    </>
  )
}

export default PetProfile
