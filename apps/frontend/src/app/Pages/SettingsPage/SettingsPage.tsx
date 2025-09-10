'use client';
import React, { useState } from 'react';
import './SettingsPage.css';
import { Container, Accordion, Form, Button } from 'react-bootstrap';
import { Icon } from '@iconify/react/dist/iconify.js';
import Image from 'next/image';
import Link from 'next/link';
import { AddressDetailsModal, BusinessDetailsModal, ServiceDetailsModal } from './SettingModal';


function SettingsPage() {

  // SettingModal Started
    const [modalShow1, setModalShow1] = React.useState(false); 
    const [modalShow2, setModalShow2] = React.useState(false); 
    const [modalShow3, setModalShow3] = React.useState(false); 
  // SettingModal Ended

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

  // Deleted information Started 

  type DeletedItem = {
    id: number;
    title: string;
    author: string;
    type: string;
    date: string;
    thumbnail: string;
    userImg: string;
  };
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([
    {
      id: 1,
      userImg: 'https://d2il6osz49gpup.cloudfront.net/Images/pet.jpg',
      title: 'Max',
      author: 'David Martin',
      type: 'Share Assessment Report',
      date: '15 Aug 2024 11:30 AM',
      thumbnail: 'https://d2il6osz49gpup.cloudfront.net/Images/report.png', 
    },
    {
      id: 2,
      userImg: 'https://d2il6osz49gpup.cloudfront.net/Images/pet.jpg',
      title: 'Bold',
      author: 'David Martin',
      type: 'Share Assessment Report',
      date: '15 Aug 2024 11:30 AM',
      thumbnail: 'https://d2il6osz49gpup.cloudfront.net/Images/report.png',
    },
  ]);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const toggleSelect = (id: number) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };
  const deleteSelected = () => {
    setDeletedItems(items => items.filter(item => !selectedItems.includes(item.id)));
    setSelectedItems([]);
  };
  const deleteAll = () => {
    setDeletedItems([]);
    setSelectedItems([]);
  };

  // Deleted information Ended  

  // FeedBack Started 

  type FeedbackItem = {
    id: number;
    user: string;
    pet: string;
    avatar: string;
    date: string;
    rating: number;
    content: string;
    expanded: boolean;
  };

  const initialFeedbacks: FeedbackItem[] = [
    {
      id: 1,
      user: 'Sky B',
      pet: 'Kizie',
      avatar: 'https://d2il6osz49gpup.cloudfront.net/Images/feedback1.png',
      date: '25 August 2024',
      rating: 5.0,
      content:
        "We are very happy with the services so far. Dr. Brown has been extremely thorough and generous with his time and explaining everything to us. When one is dealing with serious health issues it makes a huge difference to understand what's going on and know that the health providers are doing their best. Thanks!",
      expanded: true,
    },
    {
      id: 2,
      user: 'Pika',
      pet: 'Oscar',
      avatar: 'https://d2il6osz49gpup.cloudfront.net/Images/feedback2.png',
      date: '24 August 2024',
      rating: 4.7,
      content:
        "Dr. Brown, the Gastroenterology Specialist was very thorough with Oscar. Zoey was pre diabetic so Doc changed her meds from Prednisolone to Budesonide. In 5 days, Oscar’s glucose numbers were lower and in normal range. We are staying with Dr. Brown as Oscar’s vet as I don’t feel any anxiety dealing with Oscar’s illness now.",
      expanded: true,
    },
  ];
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>(initialFeedbacks);
  const [showAll, setShowAll] = useState(false);

  const toggleExpand = (id: number) => {
    setFeedbacks(f =>
      f.map(item => (item.id === id ? { ...item, expanded: !item.expanded } : item))
    );
  };

  const deleteFeedback = (id: number) => {
    setFeedbacks(f => f.filter(item => item.id !== id));
  };

  const addFeedback = () => {
    const newFeedback: FeedbackItem = {
      id: Date.now(),
      user: 'New User',
      pet: 'New Pet',
      avatar: '/avatar1.png',
      date: new Date().toLocaleDateString(),
      rating: 5,
      content: 'This is a new feedback message.',
      expanded: false,
    };
    setFeedbacks(prev => [newFeedback, ...prev]);
  };

  const displayedFeedbacks = showAll ? feedbacks : feedbacks.slice(0, 2);

  // FeedBack Ended 

  



  

  return (
    <>
      <section className='SettingPageSec'>
        <Container>
          <div className='SettingData'>
              <h4>Settings</h4>

              <div className="SettingFormDiv">

                <div className="SettingInnerprofile">
                  <div className="SetProfile">
                    <Image aria-hidden src="https://d2il6osz49gpup.cloudfront.net/Images/settingimg.png" alt="settingimg" width={150} height={150}/>
                  </div>
                  <h3>San Francisco Animal Medical Center</h3>
                  <Button><Icon icon="solar:pen-bold" width="20" height="20" /> Edit Profile</Button>
                </div>

                <div className="SettinginnerItem">
                  <h6>Business Details</h6>
                  <Button onClick={() => setModalShow1(true)}><Icon icon="solar:pen-bold" width="20" height="20" /></Button>
                </div>
                <div className="SettinginnerItem">
                  <h6>Address Details</h6>
                  <Button onClick={() => setModalShow2(true)}><Icon icon="solar:pen-bold" width="20" height="20" /></Button>
                </div>
                <div className="SettinginnerItem">
                  <h6>Service and Department Details</h6>
                  <Button onClick={() => setModalShow3(true)}><Icon icon="solar:pen-bold" width="20" height="20" /></Button>
                </div>
                <div className="SettinginnerItem">
                  <h6>Business Documnets</h6>
                  <Button><Icon icon="solar:pen-bold" width="20" height="20" /></Button>
                </div>
                <div className="SettinginnerItem">
                  <h6>Your Plan <span>Free tier - Cloud hosted</span></h6>
                  <Button><Icon icon="solar:pen-bold" width="20" height="20" /></Button>
                </div>

                <BusinessDetailsModal show={modalShow1} onHide={() => setModalShow1(false)} />
                <AddressDetailsModal show={modalShow2} onHide={() => setModalShow2(false)} />
                <ServiceDetailsModal show={modalShow3} onHide={() => setModalShow3(false)} />



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
                              <Image src="https://d2il6osz49gpup.cloudfront.net/Images/settingimg.png" alt="team-member" width={40} height={40} />
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
                <Accordion.Item eventKey="3" className='DeleteInformationItem'>
                  <Accordion.Header>Deleted information</Accordion.Header>
                  <Accordion.Body>  
                    <div className='DeleteInfoDiv'>
                      <div className="DeleteBtn">
                        <Button onClick={deleteAll}><Icon icon="solar:trash-bin-trash-bold" width="14" height="14" /> Delete All</Button>
                        <Button onClick={deleteSelected}><Icon icon="solar:trash-bin-trash-bold" width="14" height="14" /> Delete Selected </Button>
                      </div>
                      <div>
                        {deletedItems.map(item => (
                          <div key={item.id} className='DeleteReports'>

                            <div className='Deltecheck'>
                              <Form.Check type="checkbox"checked={selectedItems.includes(item.id)}onChange={() => toggleSelect(item.id)}/>
                              <Image src={item.userImg} alt={item.userImg} width={40} height={40} /> 
                              <div className='DeletTexed'>
                                <h6>{item.title}</h6>
                                <p><Icon icon="mingcute:user-2-fill" /> {item.author}</p>
                              </div>
                            </div>

                            <div className="DeletMidTexed">
                              <h6>{item.type}</h6>
                              <p>{item.date}</p>
                            </div>

                            <div className='DelteDoctDiv'>
                              <Icon icon="solar:file-download-bold" width="24" height="24" color='#302F2E' />
                              <Icon icon="solar:trash-bin-trash-bold" width="24" height="24" color='#247AED' onClick={deleteSelected}/>
                              <div className="DeletThumnil">
                                <Image src={item.thumbnail} alt={item.thumbnail} width={100} height={100}  />
                                <Link href=""><Icon icon="solar:eye-bold" width="24" height="24" color='#302F2E' /></Link>
                              </div>
                              
                            </div>

                          </div>
                        ))}
                      </div>
                      <div className="ReportBottom">
                        <p>These documents will automatically get deleted after <span>90 days.</span></p>
                      </div>                                
                    </div>
                  </Accordion.Body>
                </Accordion.Item>

                {/* === Feedback Template === */}
                <Accordion.Item eventKey="4" className='FeedBackitem'>
                  <Accordion.Header>Feedback</Accordion.Header>
                  <Accordion.Body>  
                    <div className='FeedbackInnerDiv'>
                      {displayedFeedbacks.map(f => (
                        <div key={f.id} className="feedbackCard">
                          <div className="FeedBackTopItem">
                            <div className="FeedBackUser">
                              <Image src={f.avatar} alt='' width={60} height={60} />
                              <div className='feedbackhead'>
                                <h4>{f.user}</h4>
                                <p><Image src="https://d2il6osz49gpup.cloudfront.net/Images/paws.png" alt='paws' width={16} height={16} /> {f.pet}</p>
                              </div>
                            </div>
                            <Button onClick={addFeedback}><Icon icon="solar:add-circle-bold" width={24} height={24}/> </Button>
                            {/* <Button onClick={() => deleteFeedback(f.id)}><Icon icon="solar:minus-circle-bold" width={24} height={24} /></Button> */}
                          </div>
                          <div className="FeedbackContent">
                            <div className="FeedDated">
                              <h6>{f.date}</h6>
                              <p><Icon icon="solar:star-bold" color="#007bff" /> {f.rating}</p>
                            </div>
                            <div className="FeedbackPara">
                              <p>{f.content}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="FeedMore">
                        <Button onClick={() => setShowAll(!showAll)}><Icon icon="mdi:eye" width={14} height={14} /> {showAll ? 'View Less' : 'View More'}</Button>
                      </div>             
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
