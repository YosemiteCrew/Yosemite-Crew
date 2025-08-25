"use client";
import React, { useCallback, useEffect, useState } from "react";
import "./AddVetProfile.css";
import { Button, Col, Container, Dropdown, Form, Row } from "react-bootstrap";
import { Icon } from "@iconify/react/dist/iconify.js";
import Image from "next/image";
import Link from "next/link";
import { useAuthStore } from "@/app/stores/authStore";
import {
  RelatedDoctorData,
  RelatedFhirPractitioner,
  VetNameType,
} from "@yosemite-crew/types";
import { getProfileImage } from "@/app/utils/common";
import { getData, postData } from "@/app/axios-services/services";
import Swal from "sweetalert2";
import {
  convertRelatedFhirToDoctors,
  convertToFhirPractitionerPersonalDetails,
} from "@yosemite-crew/fhir";
import { convertToFhirPractitionerProfessionalDetails } from "@yosemite-crew/fhir";
import ProfileApi from "@/app/utils/Api/profileApi";

type Member = {
  img: string;
  name: string;
  role: string;
};

function AddProileDetails() {
  const {
    profile,
    vetAndTeamsProfile,
    userId,
    userType,
    fetchVetAndTeamsProfile,
    ...rest
  } = useAuthStore();
  // personalDetails
  const [personalDetails, setPersonalDetails] = useState({
    firstName: "Adam",
    lastName: "Brown",
    rcvsNumber: "",
    sex: "Male",
    emailAddress: "adamsbrown82@gmail.com",
    dob: "09-03-1982",
    phoneNumber: "+1-6793532903",
    postalCode: "000000",
    address: "165, ANC Apartments D-block SRM Street 5",
    area: "Queens Road",
    city: "London",
    StateProvince: "London",
  });

  // professionalDetails
  const [professionalDetails, setProfessionalDetails] = useState({
    linkedin: "http://linkedin/profile/1adambownpc/day",
    medicalLicense: "ABC00000000000000",
    experience: "",
    specialisation: "Heart Surgery",
    qualification:
      "Bachelor of Medicine, Bachelor of Surgery (MBBS), general medical experience, Fellowship of the Royal College of Surgeons (FRCS)",
    bio: "Veterinary AI Leader | Clinical Data & AI Strategist | Equine Internal Medicine Specialist | Startup Advisor | Researcher | Speaker | Educator",
  });

  // orgRecord
  const [orgRecord, setOrgRecord] = useState({
    // idNumber: "ASG469271200",
    // emailAddress: "",
    yearsOfWorking: "00 Years",
    joiningDate: "Jan 10, 2025",
  });

  const [editMode, setEditMode] = useState<"personal" | "professional" | null>(
    null
  );

  const handleChange = (section: any, field: any, value: any) => {
    if (section === "personal") {
      setPersonalDetails({ ...personalDetails, [field]: value });
    } else if (section === "professional") {
      setProfessionalDetails({ ...professionalDetails, [field]: value });
    }
  };

  // Members Profile Dropdown Started

  const [selectedMember, setSelectedMember] =
    useState<RelatedDoctorData | null>(null);
  const [relatedDoctors, setRelatedDoctors] = useState<RelatedDoctorData[]>([]);

  const handleSelect = async (
    eventKey: string | null,
    _e: React.SyntheticEvent<unknown>
  ) => {
    if (eventKey !== null) {
      const member = relatedDoctors[parseInt(eventKey, 10)];
      setSelectedMember(member);
    }
  };
  // Members Profile Dropdown Ended

  const fillProfileData = useCallback(
    (data: any) => {
      const {
        firstName = "",
        lastName = "",
        rcvsNumber = "",
        medicalLicenseNumber = "",
        gender = "Unknown",
        email = "",
        dateOfBirth = "Unknown",
        mobileNumber = "",
        postalCode = "",
        addressLine1 = "",
        area = "",
        city = "",
        stateProvince = "",
        //registrationNumber = "",
        linkedin = "",
        yearsOfExperience = 0,
        biography = "",
      } = data?.name || {};
      const { specialization = "", qualification = "" } = data || {};
      setPersonalDetails({
        firstName: firstName,
        lastName: lastName,
        rcvsNumber: rcvsNumber,
        sex: gender,
        emailAddress: email,
        dob: dateOfBirth,
        phoneNumber: mobileNumber,
        postalCode: postalCode,
        address: addressLine1,
        area: area,
        city: city,
        StateProvince: stateProvince,
      });

      setProfessionalDetails({
        linkedin: linkedin,
        medicalLicense: medicalLicenseNumber,
        experience: "" + yearsOfExperience,
        specialisation: specialization,
        qualification: qualification,
        bio: biography,
      });
      setOrgRecord({
        joiningDate: data?.joiningDate ?? "",
        yearsOfWorking: data?.yearsOfWorking ?? "",
      });
    },
    [selectedMember, userId]
  );

  useEffect(() => {
    (async () => {
      if (selectedMember?.value) {
        const data = await ProfileApi.getVetAndTeamsProfile(
          selectedMember?.value
        );
        fillProfileData(data);
      }
    })();
  }, [selectedMember?.value]);
  useEffect(() => {
    fillProfileData(vetAndTeamsProfile);
  }, [profile, vetAndTeamsProfile, userType]);
  const handleEditPersonalDetails = useCallback(async () => {
    try {
      if (editMode == "personal") {
        const fhirPayload = {
          firstName: personalDetails.firstName ?? "",
          lastName: personalDetails.lastName,
          rcvsNumber: personalDetails.rcvsNumber,
          gender: personalDetails.sex,
          email: personalDetails.emailAddress,
          dateOfBirth: personalDetails.dob,
          mobileNumber: personalDetails.phoneNumber,
          postalCode: personalDetails.postalCode,
          addressLine1: personalDetails.address,
          area: personalDetails.area,
          city: personalDetails.city,
          stateProvince: personalDetails.StateProvince,
        };
        const fhirData = convertToFhirPractitionerPersonalDetails(fhirPayload);

        const data = await postData(
          `/fhir/v1/Practitioner/${userId}?section=personal`,
          fhirData,
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (data.status === 201) {
          Swal.fire({
            icon: "success",
            title: "Success",
            text: "Profile updated successfully!",
          });
          if (userId) {
            fetchVetAndTeamsProfile(userId);
          }
        }
      }
    } catch (error) {
    } finally {
      setEditMode(editMode === "personal" ? null : "personal");
    }
  }, [editMode, personalDetails]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    getData(`fhir/v1/Practitioner/related/${userId}`).then((data) => {
      if (data.status === 200 && data.data) {
        const related = data.data as RelatedFhirPractitioner[];
        const doctors = convertRelatedFhirToDoctors(related);
        setRelatedDoctors(doctors);
      }
    });
  }, [userId]);
  const handleEditProfessionalDetails = useCallback(async () => {
    try {
      if (editMode == "professional") {
        const fhirPayload = {
          linkedin: professionalDetails.linkedin ?? "",
          medicalLicenseNumber: professionalDetails.medicalLicense,
          yearsOfExperience: professionalDetails.experience,
          specialization: professionalDetails.specialisation,
          qualification: professionalDetails.qualification,
          biography: professionalDetails.bio,
        };
        const fhirData =
          convertToFhirPractitionerProfessionalDetails(fhirPayload);

        const data = await postData(
          `/fhir/v1/Practitioner/${userId}?section=professional`,
          fhirData,
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (data.status === 201) {
          Swal.fire({
            icon: "success",
            title: "Success",
            text: "Profile updated successfully!",
          });
          if (userId) {
            fetchVetAndTeamsProfile(userId);
          }
        }
      }
    } catch (error) {
    } finally {
      setEditMode(editMode === "professional" ? null : "professional");
    }
  }, [editMode, professionalDetails]);
  return (
    <>
      <section className="AddProfileDetailSec">
        <Container>
          <div className="AddProfileDetailData">
            <BackBtn
              href=""
              icon="solar:round-alt-arrow-left-outline"
              backtext="Back"
            />

            <div className="ProfileDetails">
              <div className="LeftProp">
                <Image
                  src={getProfileImage(vetAndTeamsProfile?.image ?? "")}
                  alt="Preview"
                  width={80}
                  height={80}
                />
                <div className="proptext">
                  <h4>{`${personalDetails.firstName} ${personalDetails.lastName}`}</h4>
                  <p>{userType}</p>
                </div>
              </div>
              <div className="RytProp">
                <p>
                  🎉 Your profile is verified and good to go — no new
                  appointments.
                </p>
              </div>
            </div>

            <Row>
              <Col md={8}>
                <div className="detail-card">
                  <div className="card-header">
                    <h5>Personal Details</h5>
                    {!selectedMember && (
                      <Button
                        variant="link"
                        onClick={handleEditPersonalDetails}
                      >
                        {editMode === "personal" ? (
                          <>
                            <Icon
                              icon="carbon:checkmark-filled"
                              width={18}
                              height={18}
                            />
                            Update Profile
                          </>
                        ) : (
                          <>
                            <Icon
                              icon="solar:pen-bold"
                              width={14}
                              height={14}
                            />
                            Edit Profile
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  <div className="card-body">
                    {Object.entries(personalDetails ?? {}).map(
                      ([key, value]) => (
                        <div className="detail-row" key={key}>
                          <h6>{key.replace(/([A-Z])/g, " $1")}: </h6>
                          {editMode === "personal" ? (
                            <Form.Control
                              value={value}
                              onChange={(e) =>
                                handleChange("personal", key, e.target.value)
                              }
                            />
                          ) : (
                            <p>{value}</p>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </Col>
              <Col md={4}>
                <div className="OrganistRecord">
                  <h5>Your Organisation Record</h5>
                  {Object.entries(orgRecord ?? {}).map(([key, value]) => (
                    <div className="detail-row" key={key}>
                      <h6>{key.replace(/([A-Z])/g, " $1")}: </h6> <p>{value}</p>
                    </div>
                  ))}
                </div>
              </Col>
            </Row>
            <Row>
              <Col md={8}>
                <div className="detail-card">
                  <div className="card-header">
                    <h5>Professional Details</h5>
                {
                  !selectedMember&&    <Button
                      variant="link"
                      onClick={handleEditProfessionalDetails}
                    >
                      {editMode === "professional" ? (
                        <>
                          <Icon
                            icon="carbon:checkmark-filled"
                            width={18}
                            height={18}
                          />
                          Update Profile
                        </>
                      ) : (
                        <>
                          <Icon icon="solar:pen-bold" width={14} height={14} />
                          Edit Profile
                        </>
                      )}
                    </Button>
                }
                  </div>
                  <div className="Profbody">
                    {Object.entries(professionalDetails).map(([key, value]) => (
                      <div className="detail-row" key={key}>
                        <h6>{key.replace(/([A-Z])/g, " $1")}: </h6>
                        {editMode === "professional" ? (
                          <Form.Control
                            size="sm"
                            value={value}
                            onChange={(e) =>
                              handleChange("professional", key, e.target.value)
                            }
                          />
                        ) : (
                          <p>{value}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Col>
              <Col md={4}>
                <Dropdown onSelect={handleSelect} className="members-dropdown">
                  <Dropdown.Toggle className="custom-dropdown-toggle">
                    {selectedMember ? (
                      <div className="member-item">
                        <div>
                          <h6>{selectedMember.label}</h6>
                          {/* Removed role from toggle */}
                        </div>
                      </div>
                    ) : (
                      "Members Profile"
                    )}
                  </Dropdown.Toggle>

                  <Dropdown.Menu className="custom-dropdown-menu">
                    {relatedDoctors.map((m, i) => (
                      <Dropdown.Item
                        key={i}
                        eventKey={i.toString()}
                        className="member-item"
                      >
                        <Image
                          src={m.image}
                          alt={m.label}
                          width={40}
                          height={40}
                        />
                        <div>
                          <h6>{m.label}</h6>
                          <p>{m.department}</p>
                        </div>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
              </Col>
            </Row>
          </div>
        </Container>
      </section>
    </>
  );
}

export default AddProileDetails;

type BackBtnProps = {
  href: string;
  icon: string;
  backtext: string;
};

export function BackBtn({ href, icon, backtext }: BackBtnProps) {
  return (
    <Link href={href} className="BackBtn">
      <Icon icon={icon} width="22" height="22" /> {backtext}
    </Link>
  );
}
