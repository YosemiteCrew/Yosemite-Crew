"use client";
import React, { useCallback, useState } from "react";
import { Button } from "react-bootstrap";
import { toFhirSupportTicket } from "@yosemite-crew/fhir";
import { CreateSupportTicket, TicketCategory } from "@yosemite-crew/types";
import Link from "next/link";
import { isEmail } from "validator";

import Footer from "@/app/components/Footer/Footer";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import DynamicSelect from "@/app/components/DynamicSelect/DynamicSelect";
import { postData } from "@/app/services/axios";
import Image from "next/image";

import "./ContactusPage.css";

const ContactusPage = () => {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  // Query Type
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [selectedQueryType, setSelectedQueryType] =
    useState<TicketCategory>("General Enquiry");
  const queryTypes: TicketCategory[] = [
    "General Enquiry",
    "Feature Request",
    "Data Service Access Request",
    "Complaint",
  ];
  // Subrequest options for Data Service Access Request
  const [subselectedRequest, setSubselectedRequest] = useState("");
  const subrequestOptions = [
    "The person, or the parent / guardian of the person, whose name appears above",
    "An agent authorized by the consumer to make this request on their behalf",
  ];

  // Data Service Access Request options
  const [selectedRequest, setSelectedRequest] = useState("");
  const requestOptions = [
    "Know what information is being collected from you",
    "Have your information deleted",
    "Opt-out of having your data sold to third-parties",
    "Opt-in to the sale of your personal data to third-parties",
    "Access your personal information",
    "Fix inaccurate information",
    "Receive a copy of your personal information",
    "Opt-out of having your data shared for cross-context behavioral advertising",
    "Limit the use and disclosure of your sensitive personal information",
    "Others (please specify in the comment box below)",
  ];

  // Areas
  const [area, setArea] = useState<string>("");
  type Option = {
    value: string;
    label: string;
  };
  const areaOptions: Option[] = [
    {
      value: "EU GDPR (General Data Protection Regulation)",
      label: "EU GDPR (General Data Protection Regulation)",
    },
    {
      value: "UK GDPR / Data Protection Act 2018",
      label: "UK GDPR / Data Protection Act 2018",
    },
    {
      value: "CCPA / CPRA (California Consumer Privacy Act)",
      label: "CCPA / CPRA (California Consumer Privacy Act)",
    },
    {
      value: "LGPD (Brazilian General Data Protection Law)",
      label: "LGPD (Brazilian General Data Protection Law)",
    },
    {
      value:
        "PIPEDA (Personal Information Protection and Electronic Documents Act, Canada)",
      label:
        "PIPEDA (Personal Information Protection and Electronic Documents Act, Canada)",
    },
    {
      value: "POPIA (Protection of Personal Information Act, South Africa)",
      label: "POPIA (Protection of Personal Information Act, South Africa)",
    },
    {
      value: "PDPA (Personal Data Protection Act, Singapore)",
      label: "PDPA (Personal Data Protection Act, Singapore)",
    },
    {
      value: "PIPL (Personal Information Protection Law, China)",
      label: "PIPL (Personal Information Protection Law, China)",
    },
    {
      value: "Privacy Act 1988 (Australia)",
      label: "Privacy Act 1988 (Australia)",
    },
  ];

  // Confirm checklist (multiple selections)
  const [confirmSelections, setConfirmSelections] = useState<string[]>([]);
  // Complaint specific fields
  const [complaintLink, setComplaintLink] = useState<string>("");
  const [complaintImage, setComplaintImage] = useState<File | null>(null);
  console.log(complaintImage);
  const confirmOptions = [
    "Under penalty of perjury, I declare all the above information to be true and accurate.",
    "I understand that the deletion or restriction of my personal data is irreversible and may result in the termination of services with Yosemite Crew.",
    "I understand that I will be required to validate my request my email, and I may be contacted in order to complete the request.",
  ];
  const isComplaintValid =
    fullName &&
    email &&
    message &&
    subselectedRequest &&
    confirmSelections.length === confirmOptions.length;
  const isGeneralValid = fullName && email && message;
  const isDSARValid =
    fullName &&
    email &&
    message &&
    subselectedRequest &&
    area &&
    selectedRequest &&
    confirmSelections.length === confirmOptions.length;

  const toggleConfirmOption = (option: string) => {
    setConfirmSelections((prev) =>
      prev.includes(option)
        ? prev.filter((o) => o !== option)
        : [...prev, option]
    );
  };
  const isValidEmail = (email: string): boolean => {
    return isEmail(email);
  };

  const handleContectSubmit = useCallback(async () => {
    const newErrors: { [key: string]: string } = {};
    if (!fullName.trim()) {
      newErrors.fullName = "Full name is required";
    }
    if (!message.trim()) {
      newErrors.message = "Message is required";
    }
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!isValidEmail(email)) {
      newErrors.email = "Invalid email address";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const obj: CreateSupportTicket = {
      fullName,
      message,
      emailAddress: email,
      category: selectedQueryType,
      platform: "Web Form",
      userType: "Guest",
      userStatus: "Pending",
      createdBy: "Professional",
    };
    const fhirData = toFhirSupportTicket(obj);
    setSubmitting(true);
    try {
      await postData("/fhir/v1/support/request-support", fhirData);
    } catch (error) {
      console.log(error);
    } finally {
      setSubmitting(false);
    }
  }, [
    email,
    phone,
    fullName,
    message,
    selectedQueryType,
    area,
    selectedRequest,
  ]);

  return (
    <>
      <section className="ContactUsPageSec">
        <div className="ContactWrapper">
          <div className="ContactUsData">
            <div className="LeftContactUs">
              <div className="conttexted">
                <div className="text-body-3-emphasis text-text-brand">Contact us</div>
                <div className="text-display-2 text-text-primary">Need help? We&rsquo;re all ears!</div>
              </div>
              <Image
                alt="Contact Image"
                src={
                  "https://d2il6osz49gpup.cloudfront.net/contactus-page/Contact.png"
                }
                height={586}
                width={600}
              />
            </div>

            <div className="RightContactUs">
              <div className="QueryText">
                <div className="text-display-2 text-text-primary">Submit your query</div>
              </div>

              {/* Contact Form */}
              <div className="ContactForm">
                <FormInput
                  intype="fullName"
                  inname="fullName"
                  value={fullName}
                  inlabel="Full Name"
                  onChange={(e) => setFullName(e.target.value)}
                  error={errors?.fullName}
                />
                <FormInput
                  intype="email"
                  inname="email"
                  value={email}
                  inlabel="Enter Email Address"
                  onChange={(e) => setEmail(e.target.value)}
                  error={errors?.email}
                />
                <FormInput
                  intype="phone"
                  inname="phone"
                  value={phone}
                  inlabel="Phone number (optional)"
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              {/* Radio Group */}
              <div className="QueryTypeRadioGroup">
                {queryTypes.map((type) => (
                  <label key={type}>
                    <input
                      type="radio"
                      name="queryType"
                      value={type}
                      checked={selectedQueryType === type}
                      onChange={() => setSelectedQueryType(type)}
                    />
                    {type}
                  </label>
                ))}
              </div>

              {/* One clear block per query type */}
              {selectedQueryType === "Data Service Access Request" && (
                <div className="DataServiceAccessFields">
                  <div className="SetSubmitted">
                    <div className="text-body-3-emphasis text-text-primary">You are submitting this request as</div>
                    {subrequestOptions.map((option) => (
                      <label key={option}>
                        <input
                          type="radio"
                          name="dsarSubmitAs"
                          value={option}
                          checked={subselectedRequest === option}
                          onChange={() => setSubselectedRequest(option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>

                  <div className="SetSubmitted">
                    <div className="text-body-3-emphasis text-text-primary">
                      Under the rights of which law are you making this request?
                    </div>
                    <DynamicSelect
                      options={areaOptions}
                      value={area}
                      onChange={setArea}
                      inname="area"
                      placeholder="Select one"
                    />
                  </div>

                  <div className="SetSubmitted">
                    <div className="text-body-3-emphasis text-text-primary">You are submitting this request to</div>
                    {requestOptions.map((option) => (
                      <label key={option}>
                        <input
                          type="radio"
                          name="dsarRequestTo"
                          value={option}
                          checked={selectedRequest === option}
                          onChange={() => setSelectedRequest(option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>

                  <div className="QueryDetailsFields">
                    <label htmlFor="dsar-message">
                      Please leave details regarding your action request or
                      question
                    </label>
                    <textarea
                      rows={3}
                      id="dsar-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Your Message"
                    ></textarea>
                    {errors?.message && (
                      <div
                        style={{
                          color: "var(--color-danger-600)",
                          fontSize: "14px",
                          marginTop: "4px",
                        }}
                      >
                        {errors?.message ?? ""}
                      </div>
                    )}
                  </div>

                  <div className="SetSubmitted">
                    <div className="text-body-3-emphasis text-text-primary">I confirm that</div>
                    {confirmOptions.map((option) => (
                      <label key={option}>
                        <input
                          type="checkbox"
                          name="confirmDsar"
                          value={option}
                          checked={confirmSelections.includes(option)}
                          onChange={() => toggleConfirmOption(option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>

                  <Button
                    className="SendBtn"
                    onClick={handleContectSubmit}
                    disabled={submitting || !isDSARValid}
                    style={{
                      opacity: isDSARValid ? 1 : 0.5,
                      pointerEvents: isDSARValid ? "auto" : "none",
                    }}
                  >
                    {submitting ? "submitting..." : "Send message"}
                  </Button>
                </div>
              )}

              {selectedQueryType === "Complaint" && (
                <div className="DataServiceAccessFields">
                  <div className="SetSubmitted" style={{ gap: "16px" }}>
                    <div className="text-body-3-emphasis text-text-primary">You are submitting this complaint as</div>
                    {subrequestOptions.map((option) => (
                      <label key={option}>
                        <input
                          type="radio"
                          name="complaintSubmitAs"
                          value={option}
                          checked={subselectedRequest === option}
                          onChange={() => setSubselectedRequest(option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>

                  <div className="QueryDetailsFields">
                    <label htmlFor="complaint-message">
                      Please leave details regarding your complaint.
                    </label>
                    <textarea
                      rows={3}
                      id="complaint-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Your Message"
                    ></textarea>
                    {errors?.message && (
                      <div
                        style={{
                          color: "var(--color-danger-600)",
                          fontSize: "14px",
                          marginTop: "4px",
                        }}
                      >
                        {errors?.message ?? ""}
                      </div>
                    )}
                  </div>

                  <div className="SetSubmitted">
                    <div className="text-body-3-emphasis text-text-primary">Please add link regarding your complaint (optional)</div>
                    <FormInput
                      intype="text"
                      inname="complaintLink"
                      value={complaintLink}
                      inlabel="Paste link (optional)"
                      onChange={(e) => setComplaintLink(e.target.value)}
                    />
                  </div>

                  <div className="SetSubmitted">
                    <div className="text-body-3-emphasis text-text-primary">Please add image regarding your complaint (optional)</div>
                    <div className="UploadBox">
                      <input
                        id="complaintImage"
                        type="file"
                        accept="image/*"
                        aria-label="Upload Image"
                        onChange={(e) =>
                          setComplaintImage(e.target.files?.[0] || null)
                        }
                      />
                      <label htmlFor="complaintImage" className="UploadInner">
                        <Image
                          src={
                            "https://d2il6osz49gpup.cloudfront.net/contactus-page/upload.png"
                          }
                          alt="Upload Icon"
                          height={40}
                          width={40}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="SetSubmitted">
                    <div className="text-body-3-emphasis text-text-primary">I confirm that</div>
                    {confirmOptions.map((option) => (
                      <label key={option}>
                        <input
                          type="checkbox"
                          name="confirmComplaint"
                          value={option}
                          checked={confirmSelections.includes(option)}
                          onChange={() => toggleConfirmOption(option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>

                  <Button
                    className="SendBtn"
                    onClick={handleContectSubmit}
                    disabled={submitting || !isComplaintValid}
                    style={{
                      opacity: isComplaintValid ? 1 : 0.5,
                      pointerEvents: isComplaintValid ? "auto" : "none",
                    }}
                  >
                    {submitting ? "submitting..." : "Send message"}
                  </Button>
                </div>
              )}

              {(selectedQueryType === "General Enquiry" ||
                selectedQueryType === "Feature Request") && (
                <>
                  <div className="QueryDetailsFields">
                    <label htmlFor="general-message">
                      Please leave details regarding your request
                    </label>
                    <textarea
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Your Message"
                      id="general-message"
                    ></textarea>
                    {errors?.message && (
                      <div
                        style={{
                          color: "var(--color-danger-600)",
                          fontSize: "14px",
                          marginTop: "4px",
                        }}
                      >
                        {errors?.message ?? ""}
                      </div>
                    )}
                  </div>
                  <Button
                    className="SendBtn"
                    onClick={handleContectSubmit}
                    disabled={submitting || !isGeneralValid}
                    style={{
                      opacity: isGeneralValid ? 1 : 0.5,
                      pointerEvents: isGeneralValid ? "auto" : "none",
                    }}
                  >
                    {submitting ? "submitting..." : "Send message"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="ContactInfoSec">
        <div className="ContactWrapper">
          <div className="ContactInfoData">
            <div className="LeftContInfo">
              <div className="text-body-3-emphasis text-text-brand">Contact Info</div>
              <div className="text-display-2 text-text-primary">We are happy to assist you</div>
            </div>
            <div className="ContactInfoDetail">
              <div className="LeftDetails">
                <div className="detailitem">
                  <div className="text-body-3-emphasis text-text-primary">Email Address</div>
                </div>
                <div className="detailTexed">
                  <Link href="mailto:support@yosemitecrew.com" className="text-body-3-emphasis text-text-brand">
                    support@yosemitecrew.com
                  </Link>
                  <div className="text-body-3 text-text-primary">Assistance hours: Monday - Friday 9 am to 5 pm EST</div>
                </div>
              </div>

              <div className="LeftDetails">
                <div className="detailitem">
                  <div className="text-body-3-emphasis text-text-primary">Phone</div>
                </div>
                <div className="detailTexed">
                  <Link href="tel:+49 152 277 63275" className="text-body-3-emphasis text-text-brand">+49 152 277 63275</Link>
                  <div className="text-body-3 text-text-primary">Assistance hours: Monday - Friday 9 am to 5 pm EST</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
};

export default ContactusPage;
