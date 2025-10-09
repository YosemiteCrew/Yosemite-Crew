"use client";
import React, { useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react/dist/iconify.js";

import "./LaunchGrowTab.css";

const LaunchGrowTab = () => {
  const [activeTab, setActiveTab] = useState(1); // Default active tab
  // const [hoveredTab, setHoveredTab] = useState(1);

  const Launchtabs = [
    {
      id: 1,
      title: "APIs",
      color: "#247AED",
      icon: "https://d2il6osz49gpup.cloudfront.net/Images/buildlaunch1.png",
      heading: "Application Programming Interface",
      details: [
        "Integrate essential veterinary features like appointment scheduling and medical records.",
        "Enable smooth vet-owner communication with real-time updates.",
        "Ensure secure, reliable API calls for consistent data sharing.",
        "Scale effortlessly as your app grows with robust backend support.",
      ],
    },
    {
      id: 2,
      title: "SDKs",
      color: "#E9F2FD",
      icon: "https://d2il6osz49gpup.cloudfront.net/Images/buildlaunch2.png",
      heading: "Software Development Kit",
      details: [
        "Provides APIs for authentication, user roles, patient records, appointment scheduling, and billing.",
        "Enables handling of veterinary-specific data models (species, breeds, medical history, treatments, prescriptions).",
        "Allows developers to create and publish custom plugins and microfrontends.",
        "Offers access to practice performance dashboards, and compliance reporting.",
      ],
    },
    {
      id: 3,
      title: "Pre-Built Templates",
      color: "#BBD6F9",
      icon: "https://d2il6osz49gpup.cloudfront.net/Images/buildlaunch3.png",
      heading: "Pre-Built Templates",
      details: [
        "Pre-designed workflows for booking, rescheduling, and managing veterinary visits.",
        "Standardised layout for patient history, diagnoses, treatments, and vaccination logs.",
        "Auto-fill forms for medications, dosage instructions, and treatment plans.",
        "Digital forms for surgery approvals, client consent, and pet onboarding.",
      ],
    },
    {
      id: 4,
      title: "Documentation",
      color: "#9AC2F7",
      icon: "https://d2il6osz49gpup.cloudfront.net/Images/buildlaunch4.png",
      heading: "Documentation",
      details: [
        "Endpoints, authentication methods, request/response examples, and SDK usage guides.",
        "Instructions for building plugins, using microfrontends, and integrating third-party services.",
        "Step-by-step instructions for clinic staff, including appointment management, medical records, and billing",
        "ISO27001, SOC2 Type 1, HL7 FHIR compatible and GDPR guidelines, encryption standards, access controls, and audit logs.",
        "Installation steps, server requirements, version updates, and troubleshooting tips.",
      ],
    },
  ];

  return (
    <div className="BuildLaunchTabSec">
      {Launchtabs.map((growtab) => (
        <button
          key={growtab.id}
          className={`LaunchTabDiv ${activeTab === growtab.id ? "active" : ""}`}
          style={{ backgroundColor: growtab.color }}
          onClick={() => setActiveTab(growtab.id)}
        >
          <div className="BuildText" style={{ backgroundColor: growtab.color }}>
            <h6>{growtab.id.toString().padStart(2, "0")}</h6>
            <h3>{growtab.title}</h3>
          </div>
          {activeTab === growtab.id && (
            <div className="GrowTab_Content">
              <div
                className="BuildText"
                style={{ backgroundColor: growtab.color }}
              >
                <h6>{growtab.id.toString().padStart(2, "0")}</h6>
                <h3>{growtab.title}</h3>
              </div>
              <div className="GrowTabInner">
                <div className="IconPic">
                  <Image
                    src={growtab.icon}
                    alt={`${growtab.title} icon`}
                    width={80}
                    height={80}
                  />
                </div>
                <div className="BottomText">
                  <div className="Texted">
                    <h2>{growtab.heading}</h2>
                    <ul>
                      {growtab.details?.map((detail, index) => (
                        <li key={detail}>
                          <Icon
                            icon="solar:verified-check-bold"
                            width="24"
                            height="24"
                            style={{ color: "#247AED" }}
                          />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* <FillBtn FilName="View Documentation" FilIcon="ri-draft-line" Filhref="#" /> */}
                </div>
              </div>
            </div>
          )}
        </button>
      ))}
    </div>
  );
};

export default LaunchGrowTab;
