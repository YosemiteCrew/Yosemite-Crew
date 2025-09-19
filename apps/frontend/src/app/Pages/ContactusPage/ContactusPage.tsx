"use client";
import React, { useCallback, useEffect, useState } from "react";
import "./ContactusPage.css";
import Footer from "@/app/Components/Footer/Footer";
import { Button, Container } from "react-bootstrap";
import { FormInput } from "../Sign/SignUp";
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";
import { toFhirSupportTicket } from "@yosemite-crew/fhir";
import {
  CreateSupportTicket,
  TicketCategory,
  TicketPlatform,
  UserStatus,
  UserType,
} from "@yosemite-crew/types";
import { postData } from "@/app/axios-services/services";
import { useOldAuthStore } from "@/app/stores/oldAuthStore";
import Link from "next/link";
import { Icon } from "@iconify/react/dist/iconify.js";

function ContactusPage() {
  //emails
  const { email: activeEmail, userType, isVerified } = useOldAuthStore();
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
  const [subselectedRequest, setSubSelectedRequest] = useState("");
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
    { value: "south", label: "South Zone" },
    { value: "east", label: "East Zone" },
    { value: "west", label: "West Zone" },
    { value: "central", label: "Central Zone" },
    { value: "urban", label: "Urban Area" },
    { value: "rural", label: "Rural Area" },
    { value: "coastal", label: "Coastal Area" },
  ];

  // Confirm checklist (multiple selections)
  const [confirmSelections, setConfirmSelections] = useState<string[]>([]);
  // Complaint specific fields
  const [complaintLink, setComplaintLink] = useState<string>("");
  const [complaintImage, setComplaintImage] = useState<File | null>(null);
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
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
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

    /**
     * 
     * 
    email,
    phone,
    fullName,
    message,
    selectedQueryType,
    area,
    ConfselectedRequest,
    selectedRequest,
     */
    const obj: CreateSupportTicket = {
      fullName,
      message,
      emailAddress: email,
      category: selectedQueryType,
      platform: "Web Form",
      // assignedTo:area,
      userType: userType ? "Registered" : "Guest",
      userStatus: isVerified ? "Active" : "Pending",
      createdBy: "Professional",
    };
    const fhirData = toFhirSupportTicket(obj);
    setSubmitting(true);
    try {
      const response = await postData(
        "/fhir/v1/support/request-support",
        fhirData
      );
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
    userType,
    isVerified,
  ]);
  useEffect(() => {
    setEmail(activeEmail ?? "");
  }, [activeEmail]);
  return (
    <>
      <section className="ContactUsPageSec">
        <Container>
          <div className="ContactUsData">
            <div className="LeftContactUs">
              {/* <BackBtn href="" icon="solar:round-alt-arrow-left-outline" backtext="Back to Dashboard"/> */}
              <div className="conttexted">
                <span>Contact us</span>
                <h2>
                  Need Help? <br /> We’re All Ears!
                </h2>
              </div>
            </div>

            <div className="RightContactUs">
              <div className="QueryText">
                <h3>
                  Submit <span>your query</span>
                </h3>
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
                    <p>You are submitting this request as</p>
                    {subrequestOptions.map((option, index) => (
                      <label key={index}>
                        <input
                          type="radio"
                          name="dsarSubmitAs"
                          value={option}
                          checked={subselectedRequest === option}
                          onChange={() => setSubSelectedRequest(option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>

                  <div className="SetSubmitted">
                    <p>
                      Under the rights of which law are you making this request?
                    </p>
                    <DynamicSelect
                      options={areaOptions}
                      value={area}
                      onChange={setArea}
                      inname="area"
                      placeholder="Select one"
                    />
                  </div>

                  <div className="SetSubmitted">
                    <p>You are submitting this request to</p>
                    {requestOptions.map((option, index) => (
                      <label key={index}>
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
                          color: "#EA3729",
                          fontSize: "14px",
                          marginTop: "4px",
                        }}
                      >
                        {errors?.message ?? ""}
                      </div>
                    )}
                  </div>

                  <div className="SetSubmitted">
                    <p>I confirm that</p>
                    {confirmOptions.map((option, index) => (
                      <label key={index}>
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
                    {submitting ? "submitting..." : "Send Message"}
                  </Button>
                </div>
              )}

              {selectedQueryType === "Complaint" && (
                <div className="DataServiceAccessFields">
                  <div className="SetSubmitted">
                    <p>You are submitting this complaint as</p>
                    {subrequestOptions.map((option, index) => (
                      <label key={index}>
                        <input
                          type="radio"
                          name="complaintSubmitAs"
                          value={option}
                          checked={subselectedRequest === option}
                          onChange={() => setSubSelectedRequest(option)}
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
                          color: "#EA3729",
                          fontSize: "14px",
                          marginTop: "4px",
                        }}
                      >
                        {errors?.message ?? ""}
                      </div>
                    )}
                  </div>

                  <div className="SetSubmitted">
                    <p>Please add link regarding your complaint (optional)</p>
                    <FormInput
                      intype="text"
                      inname="complaintLink"
                      value={complaintLink}
                      inlabel="Paste link (optional)"
                      onChange={(e) => setComplaintLink(e.target.value)}
                    />
                  </div>

                  <div className="SetSubmitted">
                    <p>Please add image regarding your complaint (optional)</p>
                    <div className="UploadBox">
                      <input
                        id="complaintImage"
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          setComplaintImage(e.target.files?.[0] || null)
                        }
                      />
                      <label htmlFor="complaintImage" className="UploadInner">
                        <span className="UploadText">
                          {complaintImage
                            ? complaintImage.name
                            : "Upload Image"}
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="SetSubmitted">
                    <p>I confirm that</p>
                    {confirmOptions.map((option, index) => (
                      <label key={index}>
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
                    {submitting ? "submitting..." : "Send Message"}
                  </Button>
                </div>
              )}

              {(selectedQueryType === "General Enquiry" ||
                selectedQueryType === "Feature Request") && (
                <>
                  <div className="QueryDetailsFields">
                    <label>Please leave details regarding your request</label>
                    <textarea
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Your Message"
                    ></textarea>
                    {errors?.message && (
                      <div
                        style={{
                          color: "#EA3729",
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
                    {submitting ? "submitting..." : "Send Message"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Container>
      </section>

      <section className="ContactInfoSec">
        <Container>
          <div className="ContactInfoData">
            <div className="LeftContInfo">
              <span>Contact Info</span>
              <h2>
                We are happy to <br /> assist you
              </h2>
            </div>
            <div className="ContactInfoDetail">
              <div className="LeftDetails">
                <div className="detailitem">
                  <h4>Email Address</h4>
                </div>
                <div className="detailTexed">
                  <Link href="mailto:support@yosemitecrew.com">
                    support@yosemitecrew.com
                  </Link>
                  <p>Assistance hours: Monday - Friday 9 am to 5 pm EST</p>
                </div>
              </div>

              <div className="LeftDetails">
                <div className="detailitem">
                  <h4>Phone</h4>
                </div>
                <div className="detailTexed">
                  <Link href="tel:+49 152 277 63275">+49 152 277 63275</Link>
                  <p>Assistance hours: Monday - Friday 9 am to 5 pm EST</p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Footer />
    </>
  );
}

export default ContactusPage;
