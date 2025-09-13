"use client";
import React, { useCallback, useState, useRef, useEffect } from "react";
import "./CreateAppointment.css";
import { Col, Container, Form, Row } from 'react-bootstrap';
import { FillBtn } from '../../HomePage/HomePage';
import { Icon } from '@iconify/react/dist/iconify.js';
import { FormInput } from '../../Sign/SignUp';
import DynamicDatePicker from "@/app/Components/DynamicDatePicker/DynamicDatePicker";
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";
import { getData, postData } from "@/app/axios-services/services";
import { convertAppointmentToFHIR, convertFhirToNormalPetData, convertFHIRToTimeSlots, convertFromFhirDepartment, convertFromFHIRDoctorOptions } from "@yosemite-crew/fhir";
import { NormalPetData } from "@yosemite-crew/types";
import Image from "next/image";
import { useOldAuthStore } from "@/app/stores/oldAuthStore";
import Swal from "sweetalert2";
import dayjs from "dayjs";
import weekday from "dayjs/plugin/weekday";

// Extend dayjs with weekday plugin
dayjs.extend(weekday);

interface PetDetails {
    petName: string;
    ownerName: string;
    passportNumber: string;
    microChipNumber: string;
    purposeOfVisit: string;
    appointmentType: string;
    department: string;
    veterinarian: string;
    appointmentDate: string;
    slotsId: string;
    day: string
    ownerId:string
    petId:string
}

interface TimeSlot {
    _id: string;
    time: string;
    selected: boolean;
}

function CreateAppointment() {
    const { userId } = useOldAuthStore();
    const [petDetails, setPetDetails] = useState<PetDetails>({
        petName: "",
        ownerName: "",
        ownerId:"",
        petId:"",
        passportNumber: "",
        microChipNumber: "",
        purposeOfVisit: "",
        appointmentType: "",
        department: "",
        veterinarian: "",
        appointmentDate: "",
        slotsId: "",
        day: ""
    });
    const [purposeOfVisit, setPurposeOfVisit] = useState("");
    const [appointmentType, setAppointmentType] = useState("");
    const [department, setDepartment] = useState("");
    const [doctorsId, setDoctorsId] = useState("");
    const [doctors, setDoctors] = useState<{ value: string; label: string }[]>([]);
    const [searchData, setSearchData] = useState<NormalPetData[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [departmentOptions, setDepartmentOptions] = useState<{ value: string; label: string }[]>([]);
    const [allSlots, setAllSlots] = useState<TimeSlot[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedDay, setSelectedDay] = useState<string>("");
    const [selectedSlotId, setSelectedSlotId] = useState<string>("");
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    type Option = {
        value: string;
        label: string;
    };

    const purposeOfVisitOptions: Option[] = [
        { label: "Follow-up Visit", value: "follow_up" },
        { label: "Routine Check-up", value: "routine_checkup" },
        { label: "Health Certificate", value: "health_certificate" }
    ];

    const appointmentTypeOptions: Option[] = [
        { value: "vaccination", label: "Vaccination" },
        { value: "surgery", label: "Surgery" },
        { value: "diagnostics", label: "Diagnostics" },
    ];
    const handleSetDoctorId = (value: string) => {
        setDoctorsId(value);
        setPetDetails((prev) => ({
            ...prev,
            veterinarian: value
        }));
        setErrors((prev) => ({ ...prev, veterinarian: "" }));
    };
    const handleSetDepartment = (value: string) => {
        setDepartment(value);
        setPetDetails((prev) => ({
            ...prev,
            department: value,
            veterinarian: "" // Clear veterinarian when department changes
        }));
        setDoctorsId(""); // Clear doctorsId
        setDoctors([]); // Clear doctors options
        setErrors((prev) => ({ ...prev, department: "", veterinarian: "" }));
    };
    const handleData = (data: { name: string; value: string }) => {
        setPetDetails(prev => ({
            ...prev,
            [data.name]: data.value
        }));
        setErrors((prev) => ({ ...prev, [data.name]: "" }));
    };

    const handleDateChange = (date: string | null) => {
        if (date) {
            const day = dayjs(date).format("dddd"); // Get full day name (e.g., "Monday")
            setSelectedDate(date);
            setSelectedDay(day);
            setPetDetails(prev => ({
                ...prev,
                appointmentDate: date,
                day: day
            }));
            setErrors((prev) => ({ ...prev, appointmentDate: "" }));
        } else {
            setSelectedDate(null);
            setSelectedDay("");
        }
    };

    const searchPets = useCallback(async (value: string) => {
        let names = "";
        let microChip = "";

        // Check: value has both letters and digits (microchip)
        const isMicrochip = /[a-zA-Z]/.test(value) && /\d/.test(value);

        if (isMicrochip) {
            microChip = value;
        } else {
            names = value;
        }

        try {
            const response = await getData(`/api/appointments/pets?names=${names}&microChip=${microChip}`);
            const data: any = response.data;
            const petData = convertFhirToNormalPetData(data.data);
            setSearchData(petData);
            // console.log("petdata",petData)
            setShowDropdown(petData.length > 0);
        } catch (error) {
            console.error(error);
            setSearchData([]);
            setShowDropdown(false);
        }
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchValue(value);
        searchPets(value);
    };

    const handlePetSelect = (pet: NormalPetData) => {
        setSearchValue(`${pet.petName} - ${pet.petParentName}`);
        setPetDetails(prev => ({
            ...prev,
            petName: pet.petName || "",
            ownerName: pet.petParentName || "",
            passportNumber: pet.passportNumber || "",
            microChipNumber: pet.microChipNumber || "",
            petId:pet.petId||"",
            ownerId:pet.petParentId
        }));
        setShowDropdown(false);
        setErrors((prev) => ({
            ...prev,
            petName: "",
            ownerName: "",
            passportNumber: "",
            microChipNumber: ""
        }));
    };

    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setShowDropdown(false);
        }
    };

    useEffect(() => {
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Get department for booking appointment
    useEffect(() => {
        const getDepartmentForInvite = async () => {
            try {
                const response = await getData(`/fhir/v1/getDepartmentForInvite?userId=${userId}`);
                if (response.status === 200) {
                    const data = response.data as { data: any[] };
                    const departments = convertFromFhirDepartment(data.data).map((dept: any) => ({
                        value: dept._id,
                        label: dept.name
                    }));
                    setDepartmentOptions(departments);
                } else {
                    Swal.fire({ icon: "error", title: "Error", text: "Failed to fetch departments." });
                }
            } catch (error) {
                let errorMessage = "Failed to fetch departments.";
                if (error && typeof error === "object" && "response" in error) {
                    const res = (error as any).response;
                    errorMessage = res?.data?.message || errorMessage;
                }
                Swal.fire({ icon: "error", title: "Error", text: errorMessage });
            }
        };
        getDepartmentForInvite();
    }, [userId]);

    // Get doctors when department changes
    useEffect(() => {
        const getDoctors = async () => {
            if (!department) return;

            setDoctorsId(""); // Clear doctorsId when department changes
            setPetDetails((prev) => ({ ...prev, veterinarian: "" })); // Clear veterinarian
            setDoctors([]); // Clear doctors options initially

            try {
                const response = await getData(
                    `/api/appointments/getDoctorsByDepartmentId?userId=${userId}&departmentId=${department}`
                );

                if (response.data) {
                    const data: any = response.data;
                    setDoctors(convertFromFHIRDoctorOptions(data.data));
                }
            } catch (error) {
                console.error("Error fetching doctors:", error);
            }
        };
        getDoctors();
    }, [userId, department]);

    // Get doctor's slots when doctor, day, or date changes
    useEffect(() => {
        const getDoctorsSlots = async () => {
            if (!doctorsId || !selectedDay || !selectedDate) return;

            try {
                const response = await getData(
                    `/api/appointments/getDoctorSlots?userId=${doctorsId}&day=${selectedDay}&date=${selectedDate}`
                );

                if (response.status === 200) {
                    const data: any = response.data;
                    // Assuming the API returns timeSlots array directly
                    setAllSlots(convertFHIRToTimeSlots(data.timeSlots) || []);
                    setSelectedSlotId(""); // Reset selected slot when slots change
                }
            } catch (error) {
                console.error("Error fetching doctor slots:", error);
            }
        };
        getDoctorsSlots();
    }, [doctorsId, selectedDay, selectedDate]);

    const handleSlotSelect = (slot: TimeSlot) => {
        if (slot.selected) return; // Don't allow selection of booked slots

        setSelectedSlotId(slot.time);
        setPetDetails(prev => ({
            ...prev,
            slotsId: slot._id // Store the slot ID
        }));
        setErrors((prev) => ({ ...prev, slotsId: "" }));
    };

    const handleCreateAppointment = async () => {
        const newErrors: { [key: string]: string } = {};
        if (!petDetails.petName.trim()) newErrors.petName = "Please enter Pet Name";
        if (!petDetails.ownerName.trim()) newErrors.ownerName = "Please enter Parent Name";
        if (!petDetails.passportNumber.trim()) newErrors.passportNumber = "Please enter Passport Number";
        if (!petDetails.microChipNumber.trim()) newErrors.microChipNumber = "Please enter Microchip Number";
        if (!petDetails.purposeOfVisit) newErrors.purposeOfVisit = "Please select Purpose of Visit";
        if (!petDetails.appointmentType) newErrors.appointmentType = "Please select Appointment Type";
        if (!petDetails.department) newErrors.department = "Please select Department";
        if (!petDetails.veterinarian) newErrors.veterinarian = "Please select Veterinarian";
        if (!petDetails.appointmentDate) newErrors.appointmentDate = "Please select Appointment Date";
        if (!selectedSlotId) newErrors.slotsId = "Please select a time slot";

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        try {
            // Prepare appointment data
            const appointmentData = {
                ...petDetails,
                appointmentTime: selectedSlotId,
            };
            const data = convertAppointmentToFHIR(appointmentData);
            // Call your API to create the appointment
            const response = await postData("/api/appointments/appointment", data);

            // Type definition for the expected response format
            interface OperationOutcome {
                issue?: Array<{
                    severity?: string;
                    code?: string;
                    details?: {
                        text?: string;
                    };
                }>;
                tokenNumber?: string;
            }

            // Type guard to check if response is an OperationOutcome
            const isOperationOutcome = (data: any): data is OperationOutcome => {
                return data && (Array.isArray(data.issue)) || data.tokenNumber;
            };

            if (response.status === 200) {
                // Success case
                const successMessage = isOperationOutcome(response.data) && response.data.issue?.[0]?.details?.text 
                    ? response.data.issue[0].details.text
                    : "Appointment created successfully!";
                
                const tokenNumber = isOperationOutcome(response.data) 
                    ? response.data.tokenNumber 
                    : "";

                Swal.fire({ 
                    icon: "success", 
                    title: "Success", 
                    text: tokenNumber 
                        ? `${successMessage} Token Number: ${tokenNumber}`
                        : successMessage
                });
                setErrors({});
            } 
            else if (response.status === 409) {
                // Conflict - appointment already exists
                const errorMessage = isOperationOutcome(response.data) && response.data.issue?.[0]?.details?.text
                    ? response.data.issue[0].details.text
                    : "An appointment already exists for this time slot.";
                
                Swal.fire({ 
                    icon: "error", 
                    title: "Conflict", 
                    text: errorMessage 
                });
            }
            else {
                // Other error cases
                const errorMessage = isOperationOutcome(response.data) && response.data.issue?.[0]?.details?.text
                    ? response.data.issue[0].details.text
                    : "Failed to create appointment";
                
                Swal.fire({ 
                    icon: "error", 
                    title: "Error", 
                    text: errorMessage 
                });
            }
        } catch (error) {
            // Network errors or unexpected errors
            let errorMessage = "An error occurred while creating appointment";
            
            if (error && typeof error === "object" && "response" in error) {
                const res = (error as any).response;
                if (res?.data?.issue?.[0]?.details?.text) {
                    errorMessage = res.data.issue[0].details.text;
                } else if (res?.data?.message) {
                    errorMessage = res.data.message;
                }
            }
            
            Swal.fire({ 
                icon: "error", 
                title: "Error", 
                text: errorMessage 
            });
        }
    };

    return (
        <>
            <section className='CreateAppointmentSec'>
                <Container>
                    <div className="CreateAppointmentData">
                        <h2>Create Appointment</h2>

                        <div className="CreateAppointCard">
                            <div className="CreatePetCard">
                                <div className="AddInventoryHead">
                                    <h6>Pet Detail</h6>
                                    <div className="InventrySearch" ref={dropdownRef}>
                                        <Icon icon="carbon:search" width="24" height="24" />
                                        <Form.Control
                                            type="text"
                                            placeholder="Search Pet name, Microchip Number or Parent Name."
                                            value={searchValue}
                                            onChange={handleSearchChange}
                                            onFocus={() => searchData.length > 0 && setShowDropdown(true)}
                                        />
                                        {showDropdown && searchData.length > 0 && (
                                            <div className="search-dropdown">
                                                {searchData.map((pet, index) => (
                                                    <div
                                                        key={index}
                                                        className="dropdown-item"
                                                        onClick={() => handlePetSelect(pet)}
                                                    >
                                                        <Image
                                                            aria-hidden
                                                            src={pet.petImage}
                                                            alt="eyes"
                                                            width={50}
                                                            height={50}
                                                        />
                                                        <div className="pet-name">{pet.petName}</div>
                                                        <div className="pet-owner">{pet.petParentName}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Row>
                                    <Col>
                                        <FormInput readonly={false} intype="text" inname="petName" value={petDetails.petName} inlabel="Pet Name" onChange={(e) => handleData({ name: e.target.name, value: e.target.value })} />
                                        {errors.petName && <p className="error-message">{errors.petName}</p>}
                                    </Col>
                                    <Col>
                                        <FormInput readonly={false} intype="text" inname="ownerName" value={petDetails.ownerName} inlabel="Parent Name" onChange={(e) => handleData({ name: e.target.name, value: e.target.value })} />
                                        {errors.ownerName && <p className="error-message">{errors.ownerName}</p>}
                                    </Col>
                                </Row>

                                <Row>
                                    <Col>
                                        <FormInput readonly={false} intype="text" inname="passportNumber" value={petDetails.passportNumber} inlabel="Passport " onChange={(e) => handleData({ name: e.target.name, value: e.target.value })} />
                                        {errors.passportNumber && <p className="error-message">{errors.passportNumber}</p>}
                                    </Col>
                                    <Col>
                                        <FormInput readonly={false} intype="text" inname="microChipNumber" value={petDetails.microChipNumber} inlabel="Microchip Number" onChange={(e) => handleData({ name: e.target.name, value: e.target.value })} />
                                        {errors.microChipNumber && <p className="error-message">{errors.microChipNumber}</p>}
                                    </Col>
                                </Row>
                            </div>

                            <div className="CreatePetCard">
                                <div className="AddInventoryHead">
                                    <h4>Appointment Details</h4>
                                </div>

                                <Row>
                                    <Col>
                                        <DynamicSelect options={purposeOfVisitOptions} value={purposeOfVisit} onChange={(value) => {
                                            setPurposeOfVisit(value);
                                            setPetDetails(prev => ({ ...prev, purposeOfVisit: value }));
                                        }} inname="purposeOfVisit" placeholder="Purpose of Visit" />
                                        {errors.purposeOfVisit && <p className="error-message">{errors.purposeOfVisit}</p>}
                                    </Col>
                                    <Col>
                                        <DynamicSelect options={appointmentTypeOptions} value={appointmentType} onChange={(value) => {
                                            setAppointmentType(value);
                                            setPetDetails(prev => ({ ...prev, appointmentType: value }));
                                        }} inname="appointmentType" placeholder="Appointment Type" />
                                        {errors.appointmentType && <p className="error-message">{errors.appointmentType}</p>}
                                    </Col>
                                </Row>

                                <Row>
                                    <Col>
                                        <DynamicSelect options={departmentOptions} value={department} onChange={handleSetDepartment} inname="department" placeholder="Department" />
                                        {errors.department && <p className="error-message">{errors.department}</p>}
                                    </Col>
                                    <Col>
                                        <DynamicSelect options={doctors} value={doctorsId} onChange={handleSetDoctorId} inname="veterinarian" placeholder="Select Veterinarian" />
                                        {errors.veterinarian && <p className="error-message">{errors.veterinarian}</p>}
                                    </Col>
                                </Row>

                                <Row>
                                    <Col md={12}>
                                        <DynamicDatePicker
                                            placeholder="Appointment Date"
                                            value={selectedDate}
                                            onDateChange={handleDateChange}
                                            minDate={dayjs().toDate()}
                                        />
                                        {errors.appointmentDate && <p className="error-message">{errors.appointmentDate}</p>}
                                    </Col>
                                </Row>

                                <div className="ApointTime-Container">
                                    <p>Appointment Time</p>
                                    <div className="button-group">
                                        <ul>
                                            {allSlots.map((slot) => (
                                                <li
                                                    key={slot._id}
                                                    className={`business-button ${selectedSlotId === slot.time ? "selected" : ""} ${slot.selected ? "disabled" : ""}`}
                                                    onClick={() => handleSlotSelect(slot)}
                                                >
                                                    {slot.time}
                                                    {slot.selected && <span className="booked-badge">Booked</span>}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    {errors.slotsId && <p className="error-message">{errors.slotsId}</p>}
                                </div>
                            </div>

                            <div className="CreateAppint">
                                <FillBtn
                                    icon={<Icon icon="solar:add-circle-bold" width="24" height="24" />}
                                    text="Create Appointment"
                                    href="#"
                                    onClick={handleCreateAppointment}
                                />
                            </div>
                        </div>
                    </div>
                </Container>
            </section>
        </>
    );
}

export default CreateAppointment;