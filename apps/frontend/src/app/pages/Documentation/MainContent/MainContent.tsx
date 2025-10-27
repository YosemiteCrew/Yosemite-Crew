import React, { useState } from "react";
import Image from "next/image";
import {
  appoinmentCardOne,
  appoinmentCardTwo,
  developersTable,
  logo,
  phone1,
  phone2,
} from "@/assets/images";
import "./MainContent.css";
import { featuresList } from "../data";
import FeatureCard from "../FeatureCard/FeatureCard";
import { SearchInput, SidebarContent } from "../SidebarMenu/SidebarMenu";
import { Icon } from "@iconify/react";

interface MainContentProps {
  isMobile: boolean;
}

const MainContent: React.FC<MainContentProps> = ({ isMobile }) => {
  const [showSidebarContent, setShowSidebarContent] = useState(false);

  const handleFocus = () => setShowSidebarContent(true);
  const handleBlur = () => setTimeout(() => setShowSidebarContent(false), 150);
  return (
    <div className="main-container">
      {/* Mobile Search Section */}
      {isMobile && (
        <section className="search-section">
          <div
            className={`mobile-search ${showSidebarContent ? "expanded" : ""}`}
          >
            <SearchInput onFocus={handleFocus} onBlur={handleBlur} />
            {showSidebarContent && (
              <div className="mobile-sidebar-content">
                <button
                  className="close-sidebar-btn"
                  onClick={() => setShowSidebarContent(false)}
                >
                  <Icon
                    icon="material-symbols:close-rounded"
                    width="24"
                    height="24"
                  />
                </button>
                <SidebarContent />
              </div>
            )}
          </div>
        </section>
      )}

      <>
        {/* Main Content sections */}
        <section className="intro-section">
          <h1>What is Yosemite Crew?</h1>
          <p>
            Yosemite Crew is an open-source operating system designed for the
            animal health industry. At its core is a free, fully customizable
            Practice Management System (PMS) that unifies pet care operations,
            bringing together pet owners, pet businesses, and developers into
            one innovative ecosystem.
          </p>
        </section>

        <section className="serve-section">
          <h1>Yosemite Crew Serves?</h1>
          <div className="serve-row">
            {/* Pet Owners (Left) */}
            <div className="pet-owners-card">
              <div>
                <h3>Pet Owners</h3>
                <p>
                  Book Clinical Appointment, Get Vaccine Certificates,
                  <br />
                  Pain Management Etc.
                </p>
              </div>
              <div className="phones">
                <Image
                  src={phone1}
                  alt="Pet Owner App 1"
                  className="phone1-img"
                />
                <Image
                  src={phone2}
                  alt="Pet Owner App 2"
                  className="phone2-img"
                />
              </div>
            </div>

            {/* Developers (Center) */}
            <div className="serve-center">
              <div className="circle-logo">
                <Image src={logo} alt="Yosemite Crew Logo" />
              </div>
              <div className="developers-card">
                <div>
                  <h3>Developers</h3>
                  <p>
                    A robust platform for developers to create, customize, and
                    innovate new veterinary solutions.
                  </p>
                </div>
                <div className="dev-table-wrap">
                  <Image
                    src={developersTable}
                    alt="Developers table"
                    className="developers-table"
                  />
                </div>
              </div>
            </div>
            {/* Pet Business (Right) */}
            <div className="business-card">
              <div>
                <h3>Pet Business & Services</h3>
                <p>
                  Helps veterinary practices stay organized, save time, and
                  offer superior care to their clients.
                </p>
              </div>
              <div className="appointment-cards">
                <Image
                  src={appoinmentCardOne}
                  alt="Appointment Card One"
                  className="appointment-img"
                />
                <Image
                  src={appoinmentCardTwo}
                  alt="Appointment Card Two"
                  className="appointment-img"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="crew-section">
          <h1>How Yosemite Crew Work?</h1>
          <div className="featuresGrid">
            {featuresList?.howYosemiteCrewWorks?.map((feature, index) => (
              <FeatureCard {...feature} key={index + feature.title} />
            ))}
          </div>
        </section>

        <section className="developer-section">
          <h1>For Developers</h1>
          <div className="featuresGrid">
            {featuresList?.forDevelopers?.map((feature, index) => (
              <FeatureCard {...feature} key={index + feature.title} />
            ))}
          </div>
        </section>
      </>
    </div>
  );
};

export default MainContent;
