'use client';
import React, { useState } from 'react';
import './SettingsPage.css';
import Header from '@/app/Components/Header/Header';
import { Container, Accordion, Form, Button, Badge, Row, Col } from 'react-bootstrap';
import { FormInput } from '../Sign/SignUp';
import { AiFillPlusCircle } from 'react-icons/ai';

function SettingsPage() {
  const [isLoggedIn] = useState(true);
    const [email, setEmail] = useState("");

  // --- Medical Template State ---
  const [medicalTemplate, setMedicalTemplate] = useState({
    templateType: 'Ophthalmology/Dermatology',
    animalType: 'Beagle/Dog',
    medicalCondition: 'Fair/Serious/Critical',
    checks: {
      'Temperature': true,
      'Heart Rate': true,
      'Respiratory Rate': true,
      'Muscle Condition Score': false,
      'Behaviour': false,
      'Attitude': false,
      'Blood Pressure': true,
      'Body Condition Score': true,
      'Body Weight': true,
      'Pain Score': true,
      'Hydration': true,
    },
  });

    // Add this inside your component
    const addCheckItem = () => {
    const newCheck = prompt('Enter new check item name:');
    if (newCheck && !medicalTemplate.checks.hasOwnProperty(newCheck)) {
        setMedicalTemplate((prev) => ({
        ...prev,
        checks: {
            ...prev.checks,
            [newCheck]: false, // default to false
        },
        }));
    } else {
        alert('Invalid or duplicate name.');
    }
    };

  // --- Medical Shorthands State ---
  const [shorthands, setShorthands] = useState([
    'derma/dog/beagle/: #ddgb',
    'ophthalmology/dog/beagle/: #odgb',
    'dental/dog/beagle/: #dndgb',
  ]);

  // --- Team Members State ---
  const [teamMembers, setTeamMembers] = useState([
    { name: 'Dr. Laura Evans', role: 'Internal Medicine' },
    { name: 'Dr. Luna Peters', role: 'Internal Medicine' },
    { name: 'Dr. Emily Foster', role: 'Internal Medicine' },
  ]);

  const toggleCheck = (key: keyof typeof medicalTemplate.checks) => {
    setMedicalTemplate((prev) => ({
      ...prev,
      checks: {
        ...prev.checks,
        [key]: !prev.checks[key],
      },
    }));
  };




  const addShorthand = () => {
    setShorthands([...shorthands, 'new/shorthand/: #new']);
  };

  const addTeamMember = () => {
    setTeamMembers([...teamMembers, { name: 'New Member', role: 'Role' }]);
  };

  const removeTeamMember = (index: any) => {
    const newList = [...teamMembers];
    newList.splice(index, 1);
    setTeamMembers(newList);
  };

  return (
    <>
      <Header />
      <section className='SettingPageSec'>
        <Container>
          <div className='SettingData'>
            <div className="LeftSettingData">
                <h4>Settings</h4>

                <Accordion defaultActiveKey="0" className='SettingAccordian'>
                    {/* === Medical Template === */}
                    <Accordion.Item eventKey="0" className='MedicalAcorditem'>
                        <Accordion.Header>Medical Template</Accordion.Header>
                        <Accordion.Body>
                            <Row>
                                <Col md={4}>
                                    <FormInput intype="text" inname="email" value={email}  inlabel="Template Type" onChange={(e) => setEmail(e.target.value)} />
                                </Col>
                                <Col md={4}>
                                    <FormInput intype="text" inname="email" value={email}  inlabel="Animal Type" onChange={(e) => setEmail(e.target.value)} />
                                </Col>
                                <Col md={4}>
                                    <FormInput intype="text" inname="email" value={email}  inlabel="Medical Condition" onChange={(e) => setEmail(e.target.value)} />
                                </Col>
                            </Row>
                        {/* <div className='mb-3'>
                            <Form.Label>Template Type</Form.Label>
                            <Form.Control
                            type="text"
                            value={medicalTemplate.templateType}
                            onChange={(e) =>
                                setMedicalTemplate({ ...medicalTemplate, templateType: e.target.value })
                            }
                            />
                        </div>
                        <div className='mb-3'>
                            <Form.Label>Animal Type</Form.Label>
                            <Form.Control
                            type="text"
                            value={medicalTemplate.animalType}
                            onChange={(e) =>
                                setMedicalTemplate({ ...medicalTemplate, animalType: e.target.value })
                            }
                            />
                        </div>
                        <div className='mb-3'>
                            <Form.Label>Medical Condition</Form.Label>
                            <Form.Control
                            type="text"
                            value={medicalTemplate.medicalCondition}
                            onChange={(e) =>
                                setMedicalTemplate({ ...medicalTemplate, medicalCondition: e.target.value })
                            }
                            />
                        </div> */}

                        <div className='MedicalTabs'>
                            {Object.entries(medicalTemplate.checks).map(([key, value]) => (
                            <div key={key} className='MedicalTogleDiv'>
                                <h6>{key}</h6>
                                <Form.Check
                                type="switch"
                                checked={value}
                                onChange={() => toggleCheck(key as keyof typeof medicalTemplate.checks)}
                                />
                            </div>
                            ))}
                            <Button onClick={addCheckItem}>Add More <AiFillPlusCircle /></Button>
                        </div>
                       
                        </Accordion.Body>
                    </Accordion.Item>

                    {/* === Medical Shorthands === */}
                    <Accordion.Item eventKey="1" className='MedicalShorthAcorditem'>
                        <Accordion.Header>Medical Shorthands</Accordion.Header>
                        <Accordion.Body>
                        <div>
                            {shorthands.map((item, idx) => (
                            <Badge key={idx} bg="light" text="dark" className='me-2 mb-2'>
                                {item}
                            </Badge>
                            ))}
                        </div>
                        <Button variant="secondary" onClick={addShorthand} className='mt-2'>
                            Add More
                        </Button>
                        </Accordion.Body>
                    </Accordion.Item>

                    {/* === Team Members === */}
                    <Accordion.Item eventKey="2">
                        <Accordion.Header>Team Members</Accordion.Header>
                        <Accordion.Body>
                        <div>
                            {teamMembers.map((member, idx) => (
                            <div
                                key={idx}
                                className='d-flex justify-content-between align-items-center mb-2'
                            >
                                <span>{member.name} - {member.role}</span>
                                <Button variant="outline-danger" size="sm" onClick={() => removeTeamMember(idx)}>
                                Remove
                                </Button>
                            </div>
                            ))}
                        </div>
                        <Button variant="primary" onClick={addTeamMember}>
                            Add Member
                        </Button>
                        </Accordion.Body>
                    </Accordion.Item>



                </Accordion>
            </div>

          </div>
        </Container>
      </section>
    </>
  );
}

export default SettingsPage;
