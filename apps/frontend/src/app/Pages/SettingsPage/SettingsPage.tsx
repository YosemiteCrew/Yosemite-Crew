'use client';
import React, { useState } from 'react';
import './SettingsPage.css';
import { Container, Accordion, Form, Button, Badge, Row, Col } from 'react-bootstrap';
import { AiFillPlusCircle } from 'react-icons/ai';
import { Icon } from '@iconify/react/dist/iconify.js';
import Image from 'next/image';

function SettingsPage() {

  // Practice Team
  const [teamMembers, setTeamMembers] = useState([
    { name: 'Dr. Laura Evans', role: 'Internal Medicine' },
    { name: 'Dr. Luna Peters', role: 'Internal Medicine' },
    { name: 'Dr. Emily Foster', role: 'Internal Medicine' },
  ]);

  const addTeamMember = () => {
    setTeamMembers([...teamMembers, { name: 'New Member', role: 'Role' }]);
  };
  const removeTeamMember = (index: any) => {
    const newList = [...teamMembers];
    newList.splice(index, 1);
    setTeamMembers(newList);
  };
  // Practice Team ended 

  // --- Notifications Started ---
  const [medicalTemplate, setMedicalTemplate] = useState({
    checks: {
      'Appointment Notification': true,
      'Document/Record Notification': true,
      'Emergency Appointment Notification': true,
      'Team Chat Notification': false,
      'Assessment Notification': true,
      'Patient Chat Notification': false,
      'Patient Status Notification': true,
    },
  });
  const toggleCheck = (key: keyof typeof medicalTemplate.checks) => {
    setMedicalTemplate((prev) => ({
      ...prev,
      checks: {
        ...prev.checks,
        [key]: !prev.checks[key],
      },
    }));
  };
  // --- Notifications Started ---

  

  



  

  return (
    <>
      <section className='SettingPageSec'>
        <Container>
          <div className='SettingData'>
              <h4>Settings</h4>

              <div className="SettingFormDiv">
                <div className="SettingInnerprofile">
                  <div className="SetProfile">
                    <Image aria-hidden src="/Images/settingimg.png" alt="settingimg" width={150} height={150}/>
                  </div>
                  <h3>San Francisco Animal Medical Center</h3>
                  <Button><Icon icon="solar:pen-bold" width="20" height="20" /> Edit Profile</Button>
                </div>
                <div className="SettinginnerItem">
                  <h6>Business Details</h6>
                  <Button><Icon icon="solar:pen-bold" width="20" height="20" /></Button>
                </div>
                <div className="SettinginnerItem">
                  <h6>Address Details</h6>
                  <Button><Icon icon="solar:pen-bold" width="20" height="20" /></Button>
                </div>
                <div className="SettinginnerItem">
                  <h6>Service and Department Details</h6>
                  <Button><Icon icon="solar:pen-bold" width="20" height="20" /></Button>
                </div>
                <div className="SettinginnerItem">
                  <h6>Business Documnets</h6>
                  <Button><Icon icon="solar:pen-bold" width="20" height="20" /></Button>
                </div>
                <div className="SettinginnerItem">
                  <h6>Your Plan <span>Free tier - Cloud hosted</span></h6>
                  <Button><Icon icon="solar:pen-bold" width="20" height="20" /></Button>
                </div>
              </div>



              <Accordion defaultActiveKey="0" className='SettingAccordian'>

                {/* === Practicing Team === */}
                <Accordion.Item eventKey="0">
                    <Accordion.Header>Practicing Team</Accordion.Header>
                    <Accordion.Body>
                      <div className='PracticingTeamDiv'>
                        {teamMembers.map((member, idx) => (
                          <div key={idx} className='Practicinginner'>
                            <div className="PractInfo">
                              <Image src="/Images/settingimg.png" alt="team-member" width={40} height={40} />
                              <div>
                                <h6>{member.name}</h6>
                                <p>{member.role}</p>
                              </div>
                            </div>
                            <Button onClick={() => removeTeamMember(idx)}>
                              <Icon icon="solar:minus-circle-bold" width="20" height="20" />
                            </Button>
                          </div>
                        ))}
                        <div className="Prctadbtn">
                          <Button onClick={addTeamMember}><Icon icon="carbon:checkmark-filled" width="20" height="20" /> Add Member </Button>
                        </div> 
                      </div>
                    </Accordion.Body>
                </Accordion.Item>

                {/* === Notification Template === */}
                <Accordion.Item eventKey="1" className='Notificationitem'>
                  <Accordion.Header>Notification Settings</Accordion.Header>
                  <Accordion.Body>  
                    <div className='SetNotifylTabs'>
                        {Object.entries(medicalTemplate.checks).map(([key, value]) => (
                        <div key={key} className='NotifyTogleDiv'>
                          <div className="notinfo">
                            <h6>{key}</h6>
                            <p>{key}</p>
                          </div>
                          <Form.Check  type="switch" checked={value} onChange={() => toggleCheck(key as keyof typeof medicalTemplate.checks)}/>
                        </div>
                        ))}     
                    </div>
                  </Accordion.Body>
                </Accordion.Item>

                {/* === Security  Settings Template === */}
                <Accordion.Item eventKey="2" className='SecuritySetItem'>
                  <Accordion.Header>Security  Settings</Accordion.Header>
                  <Accordion.Body>  
                    <div className='SecurtSetTabs'>
                      <h4>Two Factor Authentication</h4>
                      <span>Email ID <Icon icon="solar:verified-check-bold" width="20" height="20" color='#33A57D' /></span>
                      <span>Phone Number <Icon icon="solar:danger-triangle-bold" width="20" height="20" color='#EE5F54' /></span>
                      <div className="TwoStepCode">
                        <p>Open the <strong>Two-step verification</strong> app on your mobile device to get your verification code. <br /> Don’t have access to your mobile device? <strong>Enter a Recovery Code</strong></p>
                        <div className="veryfycontrol">
                          <Form.Control type="number" placeholder="Verification Code" />
                          <Icon icon="solar:menu-dots-square-bold" width="20" height="20" color='#302F2E' />
                        </div>
                      </div>                   
                    </div>
                  </Accordion.Body>
                </Accordion.Item>

                {/* === Deleted information Template === */}
                <Accordion.Item eventKey="3" className='SecuritySetItem'>
                  <Accordion.Header>Deleted information</Accordion.Header>
                  <Accordion.Body>  
                    <div className='SecurtSetTabs'>
                                 
                    </div>
                  </Accordion.Body>
                </Accordion.Item>

                {/* === Feedback Template === */}
                <Accordion.Item eventKey="4" className='FeedBackitem'>
                  <Accordion.Header>Feedback</Accordion.Header>
                  <Accordion.Body>  
                    <div className='FeedbackInnerDiv'>
                                    
                    </div>
                  </Accordion.Body>
                </Accordion.Item>

                  



              </Accordion>


          </div>
        </Container>
      </section>
    </>
  );
}

export default SettingsPage;
