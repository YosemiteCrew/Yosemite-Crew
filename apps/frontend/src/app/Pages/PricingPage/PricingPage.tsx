"use client";
import React, { useState } from 'react'
import './PricingPage.css'
import Footer from '@/app/Components/Footer/Footer'
import { Button, Card, Col, Container, Form, Row, Table, ToggleButton, ToggleButtonGroup } from 'react-bootstrap'
import { Icon } from '@iconify/react/dist/iconify.js'
import { featuresData, getPlanConfig, planFeatures, pricingPlans } from './PricingConst';
import { FillBtn } from '../HomePage/HomePage';
import Image from 'next/image';
import Link from 'next/link';
import FAQ from '@/app/Components/FAQ/FAQ';

function PricingPage() {


// Pricing Calculator Started 
    const [plan, setPlan] = useState<'self' | 'custom'>("self");
    const [appointments, setAppointments] = useState(120);
    const [assessments, setAssessments] = useState(200);
    const [seats, setSeats] = useState(2);
    const planConfig = getPlanConfig({ appointments, setAppointments, assessments, setAssessments, seats, setSeats });
    const currentPlan = planConfig[plan];

// Add this useEffect to set initial progress values
React.useEffect(() => {
    const sliders = document.querySelectorAll('.styled-range');
    sliders.forEach((el) => {
        const input = el as HTMLInputElement;
        const min = Number(input.min) || 0;
        const max = Number(input.max) || 100;
        const value = Number(input.value) || 0;
        const pct = ((value - min) / (max - min)) * 100;
        input.style.setProperty('--progress', `${pct}%`);
    });
}, [plan, appointments, assessments, seats]);
// Pricing Calculator Ended 

  return (
    <>

    <section className="pricingSection">
        <Container>
            <div className="PricingData">

                <div className="PricingPage-header">
                    <div className="PriceBackdiv">
                        <Link href="/"><Icon icon="solar:round-arrow-left-bold" width="24" height="24" /></Link>
                        <div className="PricinhHeadquote">
                            <h2> Transparent pricing, <span className="highlight">no hidden fees</span></h2>
                            <p>Choose a pricing plan that fits your preferred hosting option—whether you go for our fully managed cloud  hosting or take control with self-hosting.</p>
                        </div>
                    </div>
                    <div className="PricingCardDiv">
                        {pricingPlans.map((plan) => (
                        <div key={plan.id} className='PricingcardItem'>
                            <Card className="pricing-card">
                                <Card.Body>
                                    <div className="pricing-top">
                                        <Icon icon={plan.icon} width="60" height="60" color='#247AED' />
                                        <h4>{plan.title}</h4>
                                        <p>{plan.description}</p>
                                    </div>
                                    <div className="pricing-bottom">
                                        <h3>{plan.price}</h3>
                                        {plan.subText}
                                    </div>
                                    <div className="pricingbtndiv">
                                        <FillBtn icon={<Icon icon="solar:bolt-bold" width="20" height="20" />} text="Get Started" href="#" />
                                    </div>
                                    
                                </Card.Body>
                            </Card>
                        </div>
                        ))}
                    </div>
                </div>

                <div className="PricingHostingPlans">
                    <div className="HostingHead">
                        <h2><span>Hosting Plan</span> Comparison</h2>
                        <p>Explore the key differences between our cloud-hosted and self-hosted plans. Choose the one that best fits your clinic&apos;s needs.</p>
                    </div>
                    <div className="hosting-table-wrapper">
                        <Table  responsive className="hosting-table">
                            <thead>
                            <tr>
                                <th>Features</th>
                                <th className="highlight">Self-Hosting <span>(Free Plan)</span>
                                </th>
                                <th className="highlight">Pay-as-you-go</th>
                            </tr>
                            </thead>
                            <tbody>
                            {planFeatures.map((item, index) => (
                                <tr key={index}>
                                    <td>{item.feature}</td>
                                    <td>{item.selfHosting}</td>
                                    <td>{item.payAsYouGo}</td>
                                </tr>
                            ))}
                            </tbody>
                        </Table>
                    </div>
                </div>

                <div className="PricingKeyFeature">
                    <div className="HostingHead">
                        <h2><span>Key</span> Features</h2>
                        <p>No matter which hosting option you choose, you&apos;ll always get access to our full suite of essential features designed to help you manage your veterinary practice efficiently.</p>
                    </div>
                    <div className="FeatureData">
                        {featuresData.map((feature, idx) => (
                            <div key={idx} className="FeatureItem">
                            <div className="fethed">
                                <h4>{feature.title}</h4>
                            </div>
                            <div className="fetiner">
                                {feature.items.map((item, i) => (
                                <p key={i}>
                                    {item}{" "}
                                    <Image
                                    src={`${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/ftcheck.png`}
                                    alt="ftcheck"
                                    width={24}
                                    height={24}
                                    />
                                </p>
                                ))}
                            </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="PricingCalculatorDiv">

                    <div className="pricingHeading">
                        <h2>Pricing Calculator</h2>
                    </div>

                    <div className="CalculatorTabDiv">
                        <ToggleButtonGroup className='PricingPlan' type="radio" name="plans" value={plan} onChange={setPlan}>
                            <ToggleButton className={`planbtn ${plan === "self" ? "active" : ""}`} id="tbg-radio-1" value="self">
                                <div className='planText'>
                                    <h2>$0</h2>
                                    <h5> Self-Hosting <span>(Free Plan)</span> </h5>  
                                </div>
                            </ToggleButton>
                            <ToggleButton className={`planbtn ${plan === "custom" ? "active" : ""}`} id="tbg-radio-2" value="custom">
                                 <div className='planText'>
                                    <h2>Custom</h2>
                                    <h5>Pay-as-you-go</h5>  
                                </div>
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </div>  

                    <div className="PricingInfoDiv">

                        <div className="leftPriceInfo">
                            {/* Dynamic Sliders */}
                            {currentPlan.ranges.map((item: { label: string; min: number; max: number; value: number;
                                setter: (value: number) => void;}, index: number) => (
                                <div key={index} className="pricingscrolldiv" >
                                    <div className="scrolltext">
                                        <h5>{item.label}</h5>
                                        <span>{item.value}</span>
                                    </div>
                                    {/* <Form.Range className="styled-range" min={item.min} max={item.max} value={item.value} onChange={(e) => item.setter(Number(e.target.value))} /> */}
                                    <Form.Range 
                                        min={item.min} 
                                        max={item.max} 
                                        value={item.value}
                                        onChange={(e) => {
                                            const newValue = Number(e.target.value);
                                            item.setter(newValue);
                                            const percentage = ((newValue - item.min) / (item.max - item.min)) * 100;
                                            e.target.style.setProperty("--progress", `${percentage}%`);
                                        }}  
                                        className="styled-range"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="RytPriceInfo">
                            {/* Price Box */}
                            <div className="pricebox">
                                <div className="pricetext">
                                    <h2>${currentPlan.calculatePrice()}</h2>
                                    <h5>Estimated Billing</h5>
                                </div>
                                <Link href=""><Icon icon="solar:bolt-bold" width="20" height="20" /> Get Started</Link>
                            </div>

                        </div>

                    </div>  

                </div>

                <div className="EnterPlanDiv">
                    <h4>Enterprise Plan</h4>
                    <h4>Coming Soon</h4>
                </div>

                <FAQ/>

                {/* NeedHelpDiv */}
                <NeedHealp/>






            </div>

        </Container>
    </section>

    <Footer/>
    </>
  )
}

export default PricingPage

 export function NeedHealp() {
    return <div className="NeedHelpDiv">
        <div className="Needhelpitem">
            <div className="helpText">
                <h3>Need Help? We’re All Ears!</h3>
                <p>Got questions or need assistance? Just reach out! Our team is here to help.</p>
            </div>
            <div className="helpbtn">
                <Link href="#"><Icon icon="solar:chat-round-like-bold" width="18" height="18" /> Get in Touch</Link>
            </div>
        </div>
    </div>;
}
