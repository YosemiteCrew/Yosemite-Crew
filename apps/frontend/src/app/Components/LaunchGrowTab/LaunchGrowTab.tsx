"use client";
import React, {useState} from 'react'
import "./LaunchGrowTab.css"
import { BsFillPatchCheckFill } from 'react-icons/bs';
import Image from 'next/image';
import { Icon } from '@iconify/react/dist/iconify.js';

function LaunchGrowTab() {

      const [activeTab, setActiveTab] = useState(1); // Default active tab
      // const [hoveredTab, setHoveredTab] = useState(1);
    
    
    
      const Launchtabs = [
        {
          id: 1,
          title: "APIs",
          color: "#247AED",
          icon: "/Images/buildlaunch.png",
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
          icon: "/Images/buildlaunch.png",
          heading: "Application Programming Interface",
          details: [
            "Integrate essential veterinary features like appointment scheduling and medical records.",
            "Enable smooth vet-owner communication with real-time updates.",
            "Ensure secure, reliable API calls for consistent data sharing.",
            "Scale effortlessly as your app grows with robust backend support.",
          ],
          
        },
        {
          id: 3,
          title: "Pre-Built Templates",
          color: "#BBD6F9",
          icon: "/Images/buildlaunch.png",
          heading: "Application Programming Interface",
          details: [
            "Integrate essential veterinary features like appointment scheduling and medical records.",
            "Enable smooth vet-owner communication with real-time updates.",
            "Ensure secure, reliable API calls for consistent data sharing.",
            "Scale effortlessly as your app grows with robust backend support.",
          ],
          
        },
        {
          id: 4,
          title: "Documentation",
          color: "#9AC2F7",
          icon: "/Images/buildlaunch.png",
          heading: "Application Programming Interface",
          details: [
            "Integrate essential veterinary features like appointment scheduling and medical records.",
            "Enable smooth vet-owner communication with real-time updates.",
            "Ensure secure, reliable API calls for consistent data sharing.",
            "Scale effortlessly as your app grows with robust backend support.",
          ],
          
        }
      ];
    
    


    return (
        <>
            <div className="BuildLaunchTabSec">
                {Launchtabs.map((growtab) => (
                    <div
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
                                <div className="BuildText" style={{ backgroundColor: growtab.color }}>
                                    <h6>{growtab.id.toString().padStart(2, "0")}</h6>
                                    <h3>{growtab.title}</h3>
                                </div>
                                <div className="GrowTabInner">
                                    <div className="IconPic">
                                        <Image src={growtab.icon} alt={`${growtab.title} icon`}  width={80}  height={80} />
                                    </div>
                                    <div className="BottomText">
                                        <div className="Texted">
                                            <h2>{growtab.heading}</h2>
                                            <ul>
                                                {growtab.details &&
                                                    growtab.details.map((detail, index) => (
                                                        <li key={index}>
                                                            <Icon icon="solar:verified-check-bold" width="24" height="24" style={{ color: growtab.color }} />
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
                    </div>
                ))}
            </div>
        </>
    )
}

export default LaunchGrowTab
