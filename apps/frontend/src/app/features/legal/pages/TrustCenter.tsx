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

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  // --- Render Helpers ---

  const renderCertifications = () => (
    <div className="SectionGrid">
      {certifications.map((cert) => (
        <div
          className="PremiumCard"
          key={cert.name}
          style={{
            alignItems: "center",
            flexDirection: "row",
            padding: "24px",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "60px",
              height: "60px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2rem",
            }}
          >
            {/* Logic:
              1. If it's a URL (http), render Image.
              2. If it's text like "US" or "EU" (length <= 2), render as Bold Text.
              3. Otherwise, render as Emoji.
            */}
            {cert.icon.startsWith("http") ? (
              <Image
                src={cert.icon}
                alt={cert.name}
                fill
                style={{ objectFit: "contain" }}
              />
            ) : cert.icon.length <= 3 ? (
              <span
                style={{
                  fontFamily: "var(--grotesk-font)",
                  fontWeight: "700",
                  fontSize: "1.75rem",
                  color: "var(--color-text-primary)",
                }}
              >
                {cert.icon}
              </span>
            ) : (
              <span style={{ fontSize: "2.5rem" }}>{cert.icon}</span>
            )}
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
                    : cert.status === "Planned"
                      ? "var(--color-text-tertiary)"
                      : "var(--color-warning-700)",
                background:
                  cert.status === "Compliant"
                    ? "var(--color-success-100)"
                    : cert.status === "Planned"
                      ? "var(--color-neutral-100)"
                      : "var(--color-warning-100)",
                padding: "4px 10px",
                borderRadius: "100px",
                display: "inline-block",
              }}
            >
              {cert.status}
            </span>
            {cert.description && (
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "var(--color-text-secondary)",
                  marginTop: "8px",
                  lineHeight: "1.4",
                }}
              >
                {cert.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderResources = () => (
    <div className="ResourceList">
      {resources.map((res) => (
        <button
          className="OverviewResourceItem"
          key={res.title}
          type="button"
          onClick={() => (res.locked ? handleRequestAccess(res.title) : null)}
          style={{
            width: "100%",
            border: "none",
            textAlign: "left",
            font: "inherit",
          }}
        >
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
            <div
              role="button"
              tabIndex={0}
              className="ActionBtn Outline"
              onClick={(e) => {
                e.stopPropagation();
                handleCopyLink(res.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  handleCopyLink(res.id);
                }
              }}
            >
              <FiLink /> Copy link
            </div>
            {res.locked ? (
              <div
                role="button"
                tabIndex={0}
                className="ActionBtn Filled"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRequestAccess(res.title);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    handleRequestAccess(res.title);
                  }
                }}
              >
                <FiLock /> Request access
              </div>
            ) : (
              <Link
                href={res.link || "#"}
                className="ActionBtn Filled"
                style={{ textDecoration: "none" }}
                onClick={(e) => e.stopPropagation()}
              >
                <FiDownload /> Download
              </Link>
            )}
          </div>
        </button>
      ))}
    </div>
  );

  const renderControls = () => (
    <div className="SectionGrid">
      {securityPillars.map((pillar: any) => (
        <div className="PremiumCard" key={pillar.title}>
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
            {pillar.items.map((item: string) => (
              <li
                key={item}
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
          <div className="TrustHeroSplit">
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

            <div className="TrustHeroImage">
              <Image
                src="https://d2il6osz49gpup.cloudfront.net/Images/securityTrust.png"
                alt="Security Illustration"
                width={320}
                height={250}
                style={{ objectFit: "contain", width: "100%", height: "auto" }}
                priority
              />
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
                Compliance & Regulations
              </h2>
              {renderCertifications()}
            </div>
            <div className="OverviewSplit">
              <div className="OverviewLeftCol">
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
                  {securityPillars.slice(0, 4).map((pillar: any) => (
                    <div className="OverviewControlCard" key={pillar.title}>
                      <h3>
                        <span style={{ fontSize: "1.2rem" }}>
                          {pillar.icon}
                        </span>{" "}
                        {pillar.title}
                      </h3>
                      <ul className="OverviewControlList">
                        {pillar.items.slice(0, 3).map((item: string) => (
                          <li key={item}>
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
                  {resources.slice(0, 3).map((res) => (
                    <button
                      className="OverviewResourceItem"
                      key={res.title}
                      type="button"
                      onClick={() =>
                        res.locked ? handleRequestAccess(res.title) : null
                      }
                      style={{
                        width: "100%",
                        border: "none",
                        textAlign: "left",
                        font: "inherit",
                      }}
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
                    </button>
                  ))}
                </div>
              </div>
            </div>

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
              <div className="SubprocGrid">
                {subProcessors.map((sub) => (
                  <div key={sub.name} className="SubprocCard">
                    <div className="SubprocIcon">
                      {sub.logo && (
                        <Image
                          src={sub.logo}
                          alt={sub.name}
                          fill
                          style={{ objectFit: "contain" }}
                        />
                      )}
                    </div>
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
                {subProcessors.map((sub) => (
                  <tr key={sub.name}>
                    <td
                      style={{
                        fontWeight: "500",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      {sub.logo && (
                        <div
                          style={{
                            position: "relative",
                            width: "24px",
                            height: "24px",
                          }}
                        >
                          <Image
                            src={sub.logo}
                            alt={sub.name}
                            fill
                            style={{ objectFit: "contain" }}
                          />
                        </div>
                      )}
                      {sub.name}
                    </td>
                    <td>{sub.service}</td>
                    <td>{sub.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- NEW NEED HELP CARD --- */}
        <div style={{ marginTop: "80px", marginBottom: "40px" }}>
          <div className="NeedHelpDiv">
            <div className="TrustNeedHelpItem">
              <div className="helpText">
                <h3>Have questions about security?</h3>
                <p>
                  Got questions or found vulnerability? Just reach out to us!
                  Our team is here to help.
                </p>
              </div>
              <div className="helpbtn">
                <Link href="/contact">Contact support</Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- REQUEST ACCESS MODAL --- */}
      {isModalOpen && (
        <div
          className="ModalOverlay"
          role="presentation"
          onClick={handleModalClose}
        >
          <div
            className="ModalContent"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ModalHeader">
              <h3>Request Access</h3>
              <button
                className="CloseBtn"
                onClick={handleModalClose}
                aria-label="Close modal"
              >
                <FiX />
              </button>
            </div>

            <div className="ModalBody">
              <div className="ResourceInfoBox">
                <span style={{ color: "var(--color-text-secondary)" }}>
                  You are requesting access to:
                </span>
                <br />
                <strong
                  style={{ color: "var(--blue-text)", fontSize: "1.05rem" }}
                >
                  {selectedResource}
                </strong>
              </div>

              <div className="FormGrid">
                <div className="FormGroup">
                  <label htmlFor="firstName">First Name</label>
                  <input
                    id="firstName"
                    type="text"
                    className="FormInput"
                    placeholder="Jane"
                  />
                </div>
                <div className="FormGroup">
                  <label htmlFor="lastName">Last Name</label>
                  <input
                    id="lastName"
                    type="text"
                    className="FormInput"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="FormGroup">
                <label htmlFor="workEmail">Work Email</label>
                <input
                  id="workEmail"
                  type="email"
                  placeholder="jane@company.com"
                  className="FormInput"
                />
              </div>

              <div className="FormGroup">
                <label htmlFor="companyName">Company Name</label>
                <input
                  id="companyName"
                  type="text"
                  placeholder="Acme Inc."
                  className="FormInput"
                />
              </div>

              <div className="FormGroup">
                <label htmlFor="reason">Reason for Request</label>
                <select id="reason" className="FormInput" defaultValue="">
                  <option value="" disabled>
                    Select a reason...
                  </option>
                  <option value="due_diligence">Due Diligence</option>
                  <option value="audit">Customer Audit</option>
                  <option value="internal_review">Internal Review</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="ModalFooter">
              <button
                className="CancelBtn"
                onClick={handleModalClose}
                type="button"
              >
                Cancel
              </button>
              <button
                className="SubmitBtn"
                type="button"
                onClick={() => {
                  alert("Request sent! Our team will review your credentials.");
                  handleModalClose();
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
