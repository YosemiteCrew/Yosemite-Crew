"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { trustCenterData } from "./trustCenterData";
import {
  FiMail,
  FiLink,
  FiLock,
  FiDownload,
  FiCheckCircle,
  FiChevronRight,
  FiX,
} from "react-icons/fi";
import "./TrustCenter.css";

const TrustCenter = () => {
  const [activeTab, setActiveTab] = useState("Overview");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);

  const {
    hero = {
      title: "",
      subtitle: "",
      lastUpdated: "",
      email: "",
      privacyLink: "",
    },
    certifications = [],
    resources = [],
    securityPillars = [],
    subProcessors = [],
    tabs = [],
  } = trustCenterData;

  const handleRequestAccess = (resourceTitle: string) => {
    setSelectedResource(resourceTitle);
    setIsModalOpen(true);
  };

  const handleCopyLink = (id: string) => {
    const url = `${window.location.origin}/trust-center#${id}`;
    navigator.clipboard.writeText(url);
    alert("Link copied to clipboard!");
  };

  const renderCertifications = () => (
    <div className="SectionGrid">
      {certifications.map((cert, index) => (
        <div
          className="PremiumCard"
          key={index}
          style={{
            alignItems: "center",
            flexDirection: "row",
            padding: "24px",
          }}
        >
          {/* Logo Container for Next/Image */}
          <div
            style={{
              position: "relative",
              width: "60px",
              height: "60px",
              flexShrink: 0,
            }}
          >
            <Image
              src={cert.icon}
              alt={cert.name}
              fill
              style={{ objectFit: "contain" }}
            />
          </div>

          <div style={{ flex: 1, paddingLeft: "20px" }}>
            <h3
              style={{
                fontFamily: "var(--grotesk-font)",
                fontWeight: "500",
                margin: "0 0 6px 0",
                fontSize: "1.25rem",
              }}
            >
              {cert.name}
            </h3>
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: "700",
                fontFamily: "var(--satoshi-font)",
                color:
                  cert.status === "Compliant"
                    ? "var(--color-success-600)"
                    : "var(--color-warning-700)",
                background:
                  cert.status === "Compliant"
                    ? "var(--color-success-100)"
                    : "var(--color-warning-100)",
                padding: "4px 10px",
                borderRadius: "100px",
                display: "inline-block",
              }}
            >
              {cert.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderResources = () => (
    <div className="ResourceList">
      {resources.map((res, index) => (
        <div className="ResourceItem" key={index}>
          <div>
            <h3
              style={{
                fontFamily: "var(--grotesk-font)",
                fontWeight: "500",
                fontSize: "1.125rem",
                margin: 0,
                marginBottom: "4px",
              }}
            >
              {res.title}
            </h3>
            <span
              style={{
                fontSize: "0.9rem",
                color: "var(--color-text-tertiary)",
              }}
            >
              {res.type}
            </span>
          </div>
          <div className="ResourceActions">
            <button
              className="ActionBtn Outline"
              onClick={() => handleCopyLink(res.id)}
            >
              <FiLink /> Copy link
            </button>
            {res.locked ? (
              <button
                className="ActionBtn Filled"
                onClick={() => handleRequestAccess(res.title)}
              >
                <FiLock /> Request access
              </button>
            ) : (
              <Link
                href={res.link || "#"}
                className="ActionBtn Filled"
                style={{ textDecoration: "none" }}
              >
                <FiDownload /> Download
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderControls = () => (
    <div className="SectionGrid">
      {securityPillars.map((pillar, index) => (
        <div className="PremiumCard" key={index}>
          <div className="CardHeader">
            <span className="CardIcon">{pillar.icon}</span>
            <h3 className="CardTitle">{pillar.title}</h3>
          </div>
          <p
            style={{
              fontSize: "1rem",
              color: "var(--color-text-secondary)",
              lineHeight: "1.5",
            }}
          >
            {pillar.description}
          </p>
          <ul
            style={{ paddingLeft: "0", listStyle: "none", marginTop: "10px" }}
          >
            {pillar.items.map((item, idx) => (
              <li
                key={idx}
                style={{
                  marginBottom: "8px",
                  display: "flex",
                  gap: "10px",
                  fontSize: "1rem",
                }}
              >
                <span
                  style={{
                    color: "var(--color-success-500)",
                    fontWeight: "bold",
                  }}
                >
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );

  return (
    <div className="TrustPageWrapper">
      {/* 1. HERO SECTION */}
      <section className="TrustHeroSec">
        <div className="TrustHeroContainer">
          <div className="TrustHeroContent">
            <h1 className="TrustHeroTitle">{hero.title}</h1>
            <p className="TrustHeroSubtitle">{hero.subtitle}</p>

            <div className="HeroMetaLinks">
              <a href={`mailto:${hero.email}`} className="HeroLink">
                <FiMail className="HeroIcon" /> {hero.email}
              </a>
              <Link href={hero.privacyLink || "#"} className="HeroLink">
                <FiLink className="HeroIcon" /> Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. TAB NAVIGATION */}
      <div className="TrustNavBarSticky">
        <div className="TrustNavContainer">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`TrustTabBtn ${activeTab === tab ? "Active" : ""}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* 3. MAIN CONTENT */}
      <div className="TrustContentContainer">
        {/* TAB: OVERVIEW */}
        {activeTab === "Overview" && (
          <div className="OverviewDashboard">
            <div>
              <h2
                className="SectionTitle"
                style={{ margin: 0, marginBottom: "20px" }}
              >
                Compliance
              </h2>
              {renderCertifications()}
            </div>
            <div className="OverviewSplit">
              {/* Left Column */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "20px",
                  }}
                >
                  <h2
                    className="SectionTitle"
                    style={{ fontSize: "1.5rem", margin: 0 }}
                  >
                    Security Controls
                  </h2>
                  <button
                    onClick={() => setActiveTab("Controls")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--blue-text)",
                      fontWeight: "500",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    View all <FiChevronRight />
                  </button>
                </div>
                <div className="OverviewControlsGrid">
                  {securityPillars.slice(0, 4).map((pillar, index) => (
                    <div className="OverviewControlCard" key={index}>
                      <h3>
                        <span style={{ fontSize: "1.2rem" }}>
                          {pillar.icon}
                        </span>{" "}
                        {pillar.title}
                      </h3>
                      <ul className="OverviewControlList">
                        {pillar.items.slice(0, 3).map((item, idx) => (
                          <li key={idx}>
                            <FiCheckCircle
                              style={{
                                color: "var(--color-success-500)",
                                minWidth: "14px",
                              }}
                            />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column */}
              <div className="OverviewResourceCard">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "20px",
                  }}
                >
                  <h2
                    className="SectionTitle"
                    style={{ fontSize: "1.5rem", margin: 0 }}
                  >
                    Resources
                  </h2>
                  <button
                    onClick={() => setActiveTab("Resources")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--blue-text)",
                      fontWeight: "500",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    View all <FiChevronRight />
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  {resources.slice(0, 3).map((res, index) => (
                    <div
                      className="OverviewResourceItem"
                      key={index}
                      onClick={() =>
                        res.locked ? handleRequestAccess(res.title) : null
                      }
                    >
                      <div>
                        <div
                          style={{
                            fontFamily: "var(--grotesk-font)",
                            fontWeight: "500",
                            fontSize: "0.95rem",
                          }}
                        >
                          {res.title}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--color-text-tertiary)",
                          }}
                        >
                          {res.type}
                        </div>
                      </div>
                      {res.locked ? (
                        <FiLock
                          style={{ color: "var(--color-text-tertiary)" }}
                        />
                      ) : (
                        <FiDownload style={{ color: "var(--blue-text)" }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Subprocessors Summary */}
            <div className="OverviewSubproc">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                }}
              >
                <h2
                  className="SectionTitle"
                  style={{ fontSize: "1.5rem", margin: 0 }}
                >
                  Sub-processors
                </h2>
                <button
                  onClick={() => setActiveTab("Subprocessors")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--blue-text)",
                    fontWeight: "500",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  View all <FiChevronRight />
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                {subProcessors.map((sub, index) => (
                  <div
                    key={index}
                    style={{
                      padding: "12px 20px",
                      background: "var(--color-neutral-100)",
                      borderRadius: "8px",
                      fontSize: "0.9rem",
                      fontWeight: "500",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {sub.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- OTHER TABS --- */}
        {activeTab === "Resources" && (
          <div>
            <h2 className="SectionTitle" style={{ marginBottom: "30px" }}>
              Security Resources
            </h2>
            {renderResources()}
          </div>
        )}

        {activeTab === "Controls" && (
          <div>
            <h2 className="SectionTitle" style={{ marginBottom: "30px" }}>
              Security Controls (ISMS)
            </h2>
            {renderControls()}
          </div>
        )}

        {activeTab === "Subprocessors" && (
          <div className="PremiumCard">
            <h2 className="CardTitle" style={{ marginBottom: "20px" }}>
              Authorized Sub-processors
            </h2>
            <table className="SubTable">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Service</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {subProcessors.map((sub, index) => (
                  <tr key={index}>
                    <td style={{ fontWeight: "500" }}>{sub.name}</td>
                    <td>{sub.service}</td>
                    <td>{sub.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- SIMPLE CONTACT SECTION --- */}
        <div className="TrustContactSection">
          <h2 className="ContactTitle">Have questions about security?</h2>
          <p className="ContactText">
            Whether you have a question or believe you've found a vulnerability,
            our team is ready to help.
          </p>
          <Link href="/contact" className="ContactBtn">
            Contact Us
          </Link>
        </div>
      </div>

      {/* --- REQUEST ACCESS MODAL --- */}
      {isModalOpen && (
        <div className="ModalOverlay" onClick={() => setIsModalOpen(false)}>
          <div className="ModalContent" onClick={(e) => e.stopPropagation()}>
            <div className="ModalHeader">
              <h3>Request Access</h3>
              <button
                className="CloseBtn"
                onClick={() => setIsModalOpen(false)}
              >
                <FiX />
              </button>
            </div>

            <div className="ModalBody">
              <div
                style={{
                  background: "var(--color-brand-100)",
                  padding: "12px",
                  borderRadius: "8px",
                  fontSize: "0.9rem",
                  color: "var(--color-text-secondary)",
                }}
              >
                You are requesting access to: <br />
                <strong>{selectedResource}</strong>
              </div>

              <div className="FormGrid">
                <div className="FormGroup">
                  <label>First Name</label>
                  <input type="text" className="FormInput" placeholder="Jane" />
                </div>
                <div className="FormGroup">
                  <label>Last Name</label>
                  <input type="text" className="FormInput" placeholder="Doe" />
                </div>
              </div>

              <div className="FormGroup">
                <label>Work Email</label>
                <input
                  type="email"
                  placeholder="jane@company.com"
                  className="FormInput"
                />
              </div>

              <div className="FormGroup">
                <label>Company Name</label>
                <input
                  type="text"
                  placeholder="Acme Inc."
                  className="FormInput"
                />
              </div>

              <div className="FormGroup">
                <label>Reason for Request</label>
                <select className="FormInput">
                  <option>Select a reason...</option>
                  <option>Due Diligence</option>
                  <option>Customer Audit</option>
                  <option>Internal Review</option>
                  <option>Other</option>
                </select>
              </div>
            </div>

            <div className="ModalFooter">
              <button
                className="CancelBtn"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="SubmitBtn"
                onClick={() => {
                  alert("Request sent! Our team will review your credentials.");
                  setIsModalOpen(false);
                }}
              >
                Request Access
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrustCenter;
