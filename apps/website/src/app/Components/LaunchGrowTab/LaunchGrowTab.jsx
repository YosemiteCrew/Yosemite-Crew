
import React, { useState } from 'react'
import "./LaunchGrowTab.css"
import { FillBtn } from "../../Pages/Homepage/Homepage";
import { BsFillPatchCheckFill } from "react-icons/bs";

const LaunchGrowTab = () => {

       
  const [activeTab, setActiveTab] = useState(1); // Default active tab
  // const [hoveredTab, setHoveredTab] = useState(1);



  const Launchtabs = [
    {
      id: 1,
      title: "APIs",
      color: "#D04122",
      icon: `${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Devlperlanding/apllcticon.png`,
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
      title: "APIs",
      color: "#FDBD74",
      icon: `${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Devlperlanding/apllcticon.png`,
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
      title: "APIs",
      color: "#8E88D2",
      icon: `${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Devlperlanding/apllcticon.png`,
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
      title: "APIs",
      color: "#8AC1B1",
      icon: `${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Devlperlanding/apllcticon.png`,
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

    


      {/* <div className="BuildLaunchTabSec">
        {Launchtabs.map((growtab) => (
          <div key={growtab.id} className={`LaunchTabDiv ${hoveredTab === growtab.id ? "hovered" : ""}`}
            style={{ backgroundColor: growtab.color }}
            onMouseEnter={() => setHoveredTab(growtab.id)}
            onMouseLeave={() => setHoveredTab(null)} // Optionally keep hovered state on mouse leave by removing this line
          >
            <div className="BuildText">
              <h6>{growtab.id.toString().padStart(2, "0")}</h6>
              <h3>{growtab.title}</h3>
            </div>
            {hoveredTab === growtab.id && (
              <div className="GrowTab_Content">
            <div className="BuildText" style={{ backgroundColor: growtab.color }}>
              <h6>{growtab.id.toString().padStart(2, "0")}</h6>
              <h3>{growtab.title}</h3>
            </div>
            <div className="GrowTabInner">
              <div className="IconPic">
                <img src={growtab.icon} alt={`${growtab.title} icon`} width={80} height={80} /> 
              </div>
              <div className="BottomText">
                <div className="Texted">
                  <h2>{growtab.heading}</h2>
                  <ul>
                    {growtab.details &&
                      growtab.details.map((detail, index) => (
                        <li key={index}>
                          <BsFillPatchCheckFill style={{ color: growtab.color , width:"24px" , height: "24px" }} />
                          {detail}
                        </li>
                      ))}
                  </ul>
                </div>
                
                <FillBtn FilName="View Documentation" FilIcon="ri-draft-line" Filhref="#" />
              </div>
              
            </div>
          </div>
            )}
          </div>
        ))}
      </div> */}


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
                      <img src={growtab.icon} alt={`${growtab.title} icon`} width={80} height={80} /> 
                    </div>
                    <div className="BottomText">
                      <div className="Texted">
                        <h2>{growtab.heading}</h2>
                        <ul>
                          {growtab.details &&
                            growtab.details.map((detail, index) => (
                              <li key={index}>
                                <BsFillPatchCheckFill style={{ color: growtab.color , width:"24px" , height: "24px" }} />
                                {detail}
                              </li>
                            ))}
                        </ul>
                      </div>
                      
                      <FillBtn  FilName="View Documentation" FilIcon="ri-draft-line" Filhref="#" />
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