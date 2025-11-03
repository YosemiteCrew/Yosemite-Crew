"use client";
import React, { useState } from "react";
import {
  Card,
  Container,
  Form,
  Table,
  ToggleButton,
  ToggleButtonGroup,
} from "react-bootstrap";
import { Icon } from "@iconify/react/dist/iconify.js";
import Image from "next/image";
import Link from "next/link";

import { getPlanConfig } from "@/app/pages/PricingPage/PricingConst";
import Faq from "@/app/components/Faq/Faq";
import Footer from "@/app/components/Footer/Footer";
import { pricingPlans, planFeatures, featuresData } from "./data.json";
import { Primary } from "@/app/components/Buttons";

import "./PricingPage.css";

const PricingPage = () => {
  // Pricing Calculator Started
  const [plan, setPlan] = useState<"self" | "custom">("self");
  const [appointments, setAppointments] = useState(120);
  const [assessments, setAssessments] = useState(200);
  const [seats, setSeats] = useState(2);
  const planConfig = getPlanConfig({
    appointments,
    setAppointments,
    assessments,
    setAssessments,
    seats,
    setSeats,
  });
  const currentPlan = planConfig[plan];

  // Add this useEffect to set initial progress values
  React.useEffect(() => {
    const sliders = document.querySelectorAll(".styled-range");
    for (const el of sliders ?? []) {
      const input = el as HTMLInputElement;
      const min = Number(input.min) || 0;
      const max = Number(input.max) || 100;
      const value = Number(input.value) || 0;
      const pct = ((value - min) / (max - min)) * 100;
      input.style.setProperty("--progress", `${pct}%`);
    }
  }, [plan, appointments, assessments, seats]);
  // Pricing Calculator Ended

  return (
    <>
      <section className="pricingSection">
        <Container>
          <div className="PricingData">
            <div className="PricingPage-header">
              <div className="PriceBackdiv">
                {/* <Link href="/"><Icon icon="solar:round-arrow-left-bold" width="24" height="24" /></Link> */}
                <div className="PricinhHeadquote">
                  <h2>Transparent pricing, no hidden fees</h2>
                  <p>
                    Choose a pricing plan that fits your preferred hosting
                    option whether you go for our fully managed cloud hosting or
                    take control with self-hosting.
                  </p>
                </div>
              </div>
              <div className="PricingCardDiv">
                {pricingPlans.map((plan) => (
                  <div key={plan.id} className="PricingcardItem">
                    <Card
                      className="pricing-card"
                      style={{
                        background: plan.bgColor,
                        borderColor: plan.color,
                      }}
                    >
                      <Card.Body>
                        <div className="pricing-top">
                          <Icon
                            icon={plan.icon}
                            width="60"
                            height="60"
                            color={plan.iconColor}
                            className="pricing-card-icon"
                          />
                          <h4
                            style={{ color: plan.color }}
                            dangerouslySetInnerHTML={{ __html: plan.title }}
                          />
                          <p style={{ color: plan.color }}>
                            {plan.description}
                          </p>
                        </div>
                        <div className="pricing-bottom">
                          <div className="pricing-info">
                            <h3 style={{ color: plan.color }}>{plan.price}</h3>
                            <p
                              style={{ color: plan.color }}
                              dangerouslySetInnerHTML={{ __html: plan.subText }}
                            />
                          </div>
                          <div className="pricingbtndiv">
                            <Primary
                              style={{
                                width: "142px",
                                height: "48px",
                                minHeight: "48px",
                              }}
                              text="Get Started"
                              href="#pricing-info-div"
                              onClick={() => {
                                setPlan(plan.label as "self" | "custom");
                                const el =
                                  document.getElementById("pricing-info-div");
                                if (el)
                                  el.scrollIntoView({ behavior: "smooth" });
                              }}
                            />
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  </div>
                ))}
              </div>
            </div>

            <div className="PricingHostingPlans">
              <div className="HostingHead">
                <h2>Comparison of hosting plans</h2>
                <p>
                  Explore the key differences between our cloud-hosted and
                  self-hosted plans. Choose the one that best fits your
                  clinic&apos;s needs.
                </p>
              </div>
              <div className="hosting-table-wrapper">
                <Table className="hosting-table">
                  <thead>
                    <tr>
                      <th>Features</th>
                      <th className="highlight">Self-hosting (free plan)</th>
                      <th className="highlight">Pay-as-you-go</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planFeatures.map((item) => (
                      <tr key={item.feature}>
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
                <h2>Key features</h2>
                <p>
                  No matter which hosting option you choose, you&apos;ll always
                  get access to our full suite of essential features designed to
                  help you manage your veterinary practice efficiently.
                </p>
              </div>
              <div className="FeatureData">
                {featuresData.map((feature) => (
                  <div key={feature.title} className="FeatureItem">
                    <div className="fethed">
                      <h4>{feature.title}</h4>
                    </div>
                    <div className="fetiner">
                      {feature.items.map((item) => (
                        <p key={item}>
                          {item}{" "}
                          <Image
                            src={`https://d2il6osz49gpup.cloudfront.net/ftcheck.png`}
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

            <div className="EnterPlanDiv">
              <h4>Enterprise plan</h4>
              <h4>Coming soon</h4>
            </div>

            <div className="PricingCalculatorDiv" id="pricing-info-div">
              <div className="pricingHeading">
                <h2>Pricing calculator</h2>
              </div>

              <div className="CalculatorTabDiv">
                <ToggleButtonGroup
                  className="PricingPlan"
                  type="radio"
                  name="plans"
                  value={plan}
                  onChange={setPlan}
                >
                  <ToggleButton
                    className={`planbtn ${plan === "self" ? "active" : ""}`}
                    id="tbg-radio-1"
                    value="self"
                  >
                    <div className="planText">
                      <h2>$0</h2>
                      <h5>Free plan</h5>
                    </div>
                  </ToggleButton>
                  <ToggleButton
                    className={`planbtn ${plan === "custom" ? "active" : ""}`}
                    id="tbg-radio-2"
                    value="custom"
                  >
                    <div className="planText">
                      <h2>Custom</h2>
                      <h5>Pay-as-you-go</h5>
                    </div>
                  </ToggleButton>
                </ToggleButtonGroup>
              </div>

              <div className="PricingInfoDiv">
                <div className="leftPriceInfo">
                  {currentPlan.ranges.map(
                    (item: {
                      label: string;
                      min: number;
                      max: number;
                      value: number;
                      setter: (value: number) => void;
                    }) => (
                      <div key={item.label} className="pricingscrolldiv">
                        <div className="scrolltext">
                          <h5>{item.label}</h5>
                          <span>{item.value}</span>
                        </div>
                        <Form.Range
                          min={item.min}
                          max={item.max}
                          value={item.value}
                          onChange={(e) => {
                            const newValue = Number(e.target.value);
                            item.setter(newValue);
                            const percentage =
                              ((newValue - item.min) / (item.max - item.min)) *
                              100;
                            e.target.style.setProperty(
                              "--progress",
                              `${percentage}%`
                            );
                          }}
                          className="styled-range"
                        />
                      </div>
                    )
                  )}
                </div>

                <div className="RytPriceInfo">
                  <div className="pricebox">
                    <div className="pricetext">
                      <h2>${currentPlan.calculatePrice()}</h2>
                      <h5>Price Cap</h5>
                      <p>
                        This is the maximum price you will pay, even if you go
                        over your limit.
                      </p>
                    </div>
                    <Link
                      href={plan === "self" ? "/developerslanding" : "/signup"}
                    >
                      Get started
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <Faq />

            {/* NeedHelpDiv */}
            <NeedHealp />
          </div>
        </Container>
      </section>

      <Footer />
    </>
  );
};

export default PricingPage;

const NeedHealp = () => {
  return (
    <div className="NeedHelpDiv">
      <div className="Needhelpitem">
        <div className="helpText">
          <h3>Need Help? We’re All Ears!</h3>
          <p>
            Got questions or need assistance? Just reach out! Our team is here
            to help.
          </p>
        </div>
        <div className="helpbtn">
          <Link href="/contact">Contact support</Link>
        </div>
      </div>
    </div>
  );
};

export { NeedHealp };
