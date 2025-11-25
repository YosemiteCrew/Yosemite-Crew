"use client";
import React, { useState, useCallback, useMemo } from "react";

// --- MOCK DATA & TYPES ---
const mockData = {
    doctors: ["Dr. David Brown", "Dr. Emily Johnson", "Dr. Megan Clark", "Dr. Sam Johnson"],
    services: ["Routine & Preventive Care", "Surgery Consultation", "Diagnostic Imaging"],
    appointmentTypes: ["Annual Health", "Sick Visit", "Follow Up"],
    staffRoles: ["Lead", "Support", "Technician", "Assistant"],
    searchCompanions: [
        'King Sky B (Dog)', // Example 1
        'Kizzie Brown (Cat)', // Example 2
        'Rocky Jones (Dog)',  // Example 3
        'Luna Smith (Cat)',   // Example 4
    ],
};

interface StaffMemberType { role: string; name: string; }
interface BillableServiceType {
    id: string; name: string; description: string; price: number;
    quantity: number; discountPercent: number; subTotal: number;
}
interface FormData {
    companionSearch: string; companionType: string; petName: string; breed: string;
    specialty: string; service: string; notes: string;
    date: string; time: string; isEmergency: boolean;
    staff: StaffMemberType[];
    services: BillableServiceType[];
}

const initialFormData: FormData = {
    companionSearch: "Kizzie", companionType: "Dog", petName: "Sky Brown", breed: "Beagle",
    specialty: "Internal medicine", service: mockData.services[0],
    notes: "Describe concerns...", date: "Dec 10th 2025", time: "10:30 AM",
    isEmergency: false,
    staff: [
        { role: "Lead", name: "Dr. David Brown" },
        { role: "Support", name: "John Thomson" },
        { role: "Technician", name: "Lily Carter" },
        { role: "Assistant", name: "Adams K" }
    ],
    services: [
        { id: "svc-1", name: "Routine and preventive care", description: "Comprehensive checkup to review diet, administer necessary vaccines, prevent parasites, and detect any early signs of illness.", price: 80, quantity: 1, discountPercent: 10, subTotal: 72 },
    ],
};

// Base style object for standard inputs
const InputStyles = {
    width: '100%',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    padding: '0.5rem',
    fontSize: '0.875rem',
    outline: 'none',
    transition: 'border-color 0.15s ease',
};


// --- REUSABLE COMPONENTS (INLINE CSS) ---

// 1. Standard Form Input
const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 500, color: '#4b5563', marginBottom: '0.25rem' }}>{label}</label>
        <input
            {...props}
            style={InputStyles}
        />
    </div>
);

// 1. Standard Form Select
const FormSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: string[] }> = ({ label, options, defaultValue, ...props }) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 500, color: '#4b5563', marginBottom: '0.25rem' }}>{label}</label>
        <select
            {...props}
            defaultValue={defaultValue}
            style={{ ...InputStyles, backgroundColor: 'white' }}
        >
            {options.map(option => (
                <option key={option} value={option}>{option}</option>
            ))}
        </select>
    </div>
);

// 2. Staff Member Display (Partial)
const StaffMember: React.FC<{ member: StaffMemberType; onRemove: () => void }> = ({ member, onRemove }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
            <span style={{ fontWeight: 500, color: '#4b5563', width: '6rem', flexShrink: 0 }}>{member.role}:</span>
            <span style={{ color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</span>
        </div>
        <button type="button" onClick={onRemove} style={{ color: '#9ca3af', padding: '4px', transition: 'color 0.15s ease', cursor: 'pointer', border: 'none', background: 'none' }}>
            &times;
        </button>
    </div>
);

// 3. Billable Service Card (Partial)
const BillableServiceCard: React.FC<{ service: BillableServiceType; onRemove: () => void }> = ({ service, onRemove }) => (
    <div style={{ border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '1rem', backgroundColor: 'white', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{}}>
            <div style={{ display: "flex", gap: 10, borderBottom: "1px solid lightgray", paddingBottom: 15, marginBottom: 10 }}><div style={{ color: "grey" }}>Service: </div> <div>{service.name}</div></div>
            <div style={{ display: "flex", gap: 10, borderBottom: "1px solid lightgray", paddingBottom: 15, marginBottom: 10 }}><div style={{ color: "grey" }}>Description: </div> <div>{service.description}</div></div>
            <div style={{ display: "flex", gap: 10, borderBottom: "1px solid lightgray", paddingBottom: 15, marginBottom: 10 }}><div style={{ color: "grey" }}>Price: </div> <div>${service.price}</div></div>
            <div style={{ display: "flex", gap: 10, borderBottom: "1px solid lightgray", paddingBottom: 15, marginBottom: 10 }}><div style={{ color: "grey" }}>Discount: </div> <div>{service.discountPercent}%</div></div>
            <div style={{ display: "flex", gap: 10, paddingBottom: 15, marginBottom: 10 }}><div style={{ color: "grey" }}>Sub Total: </div> <div>${service.subTotal}</div></div>
        </div>
    </div>
);

// 4. Date and Time Buttons (Partial)
const TimeButton: React.FC<{ time: string; active?: boolean; onClick: () => void }> = ({ time, active = false, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.75rem',
            fontWeight: 500,
            border: active ? '1px solid #2563eb' : '1px solid #d1d5db',
            transition: 'background-color 0.15s ease, border-color 0.15s ease',
            backgroundColor: active ? '#2563eb' : 'white',
            color: active ? 'white' : '#4b5563',
            cursor: 'pointer',
            minWidth: 'auto'
        }}
    >
        {time}
    </button>
);

const DateButton: React.FC<{ day: string; date: number; active?: boolean }> = ({ day, date, active = false }) => (
    <button
        type="button"
        style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '0.5rem',
            borderRadius: '0.5rem',
            transition: 'background-color 0.15s ease',
            width: '100%',
            backgroundColor: active ? '#eff6ff' : 'white',
            color: active ? '#2563eb' : '#4b5563',
            fontWeight: active ? 700 : 400,
            border: 'none',
            cursor: 'pointer'
        }}
    >
        <span style={{ fontSize: '0.75rem' }}>{day}</span>
        <span style={{ fontSize: '1.125rem', color: active ? '#2563eb' : '#4b5563' }}>{date}</span>
    </button>
);

// Collapsible Section (Partial)
const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen: boolean }> = ({ title, children, defaultOpen }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const toggle = () => setIsOpen(!isOpen);

    const chevronStyle = {
        color: '#374151',
        transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
        transition: 'transform 0.2s ease',
        cursor: 'pointer',
        width: '1rem',
        height: '1rem',
        marginRight: '0.5rem',
        paddingTop: '3px'
    };

    const ChevronIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={chevronStyle}>
            <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
    );

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
                onClick={toggle}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    color: '#374151',
                    // borderBottom: '1px solid #e5e7eb', 
                    paddingBottom: '0.5rem',
                    paddingTop: '0.5rem',
                    marginLeft: '-0.5rem',
                    width: 'calc(100% + 1rem)'
                }}
            >
                <ChevronIcon />
                {title}
            </div>
            {isOpen && <div style={{ overflow: 'hidden' }}>{children}</div>}
        </section>
    );
};


// --- NEW COMPONENT: Search Input with Dropdown (Used in Companion Details) ---
const CompanionSearchInput: React.FC<{ value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onSelect: (name: string) => void }> = ({ value, onChange, onSelect }) => {
    const [isFocused, setIsFocused] = useState(false);
    const [searchQuery, setSearchQuery] = useState(value);

    const filteredResults = useMemo(() => {
        if (searchQuery.length < 2) return [];
        return mockData.searchCompanions.filter(name =>
            name.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 5);
    }, [searchQuery]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        onChange(e);
    };

    const handleSelect = (name: string) => {
        setSearchQuery(name);
        onSelect(name);
        setIsFocused(false);
    };

    return (
        <div style={{ position: 'relative', width: '100%', marginBottom: '1rem' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                    type="text"
                    placeholder="Search companion name or parent name"
                    value={searchQuery}
                    onChange={handleInputChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                    style={{ ...InputStyles, paddingRight: '2.5rem', borderRadius: '30px' }}
                />
                <span style={{ position: 'absolute', right: '1rem', color: '#9ca3af' }}>&#x1F50D;</span>
            </div>

            {(isFocused && filteredResults.length > 0) && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60, backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                    {filteredResults.map((name, index) => (
                        <div
                            key={index}
                            onMouseDown={() => handleSelect(name)}
                            style={{ padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.875rem', color: '#1f2937', borderBottom: index < filteredResults.length - 1 ? '1px solid #f3f4f6' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                            {name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


// --- MAIN COMPONENT ---
const AddAppointmentModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const [formData, setFormData] = useState<FormData>(initialFormData);

    if (!isOpen) return null;

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    // --- CRITICAL UPDATE: Handle selection and update all 4 fields ---
    const handleSearchSelect = (selectedCompanion: string) => {
        // Parse the selected string (e.g., "King Sky B (Dog)")
        const [petOwnerName, typeBracket] = selectedCompanion.split(' (');
        const [petName, ownerName] = petOwnerName.split(' ');
        const companionType = typeBracket.replace(')', '');

        let newBreed = 'Beagle';
        if (companionType === 'Cat') newBreed = 'Siamese';
        if (petName === 'Rocky') newBreed = 'Dachshund';

        setFormData(prev => ({
            ...prev,
            companionSearch: petName,
            petName: ownerName ? ownerName : 'Unknown Parent', // Using the second word as owner for mock
            companionType: companionType,
            breed: newBreed,
        }));
    };
    // -----------------------------------------------------------------


    const handleTimeSelect = (time: string) => { setFormData(prev => ({ ...prev, time: time })); };
    const handleRemoveStaff = (nameToRemove: string) => { setFormData(prev => ({ ...prev, staff: prev.staff.filter(member => member.name !== nameToRemove), })); };
    const handleRemoveService = (idToRemove: string) => { setFormData(prev => ({ ...prev, services: prev.services.filter(service => service.id !== idToRemove), })); };
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); console.log("Submitting Appointment Data:", formData); alert("Appointment Submitted!"); };
    const isTimeActive = (time: string) => formData.time === time;


    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
            <div
                style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
                onClick={onClose}
            ></div>

            <div style={{ backgroundColor: 'white', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', width: '100%', maxWidth: '32rem', height: '100%', overflowY: 'auto', position: 'relative', zIndex: 50 }}>
                <form onSubmit={handleSubmit} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

                    {/* Header */}

                    {/* Modal Content - Scrollable Body */}
                    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 70 }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937' }}>Add appointment</h2>
                            <button type="button" onClick={onClose} style={{ color: '#9ca3af', padding: '4px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.5rem', transition: 'color 0.15s ease' }}>
                                &times;
                            </button>
                        </div>

                        {/* Section 1: Companion Details (COLLAPSIBLE) */}
                        <CollapsibleSection title="Companion details" defaultOpen={true}>
                            <CompanionSearchInput
                                value={formData.companionSearch}
                                onChange={handleFormChange}
                                onSelect={handleSearchSelect}
                            />

                            {/* Inputs for Companion Data */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                                <FormInput
                                    label="Companion name"
                                    name="companionSearch"
                                    defaultValue={formData.companionSearch}
                                    value={formData.companionSearch} // Use value for controlled input
                                    readOnly
                                />
                                <FormInput
                                    label="Parent name"
                                    name="petName"
                                    defaultValue={formData.petName}
                                    value={formData.petName}
                                    readOnly
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                                <FormInput
                                    label="Companion type"
                                    name="companionType"
                                    defaultValue={formData.companionType}
                                    value={formData.companionType}
                                    readOnly
                                />
                                <FormInput
                                    label="Breed"
                                    name="breed"
                                    defaultValue={formData.breed}
                                    value={formData.breed}
                                    readOnly
                                />
                            </div>
                        </CollapsibleSection>

                        {/* Section 2: Appointment Details (COLLAPSIBLE) */}
                        <CollapsibleSection title="Appointment details" defaultOpen={true}>
                            <div style={{}}>
                                <FormSelect
                                    label="Speciality"
                                    name="specialty"
                                    options={[formData.specialty]}
                                    defaultValue={formData.specialty}
                                    onChange={handleFormChange}
                                />
                                <FormSelect
                                    label="Service"
                                    name="service"
                                    options={mockData.services}
                                    defaultValue={formData.service}
                                    onChange={handleFormChange}
                                />
                            </div>

                            <div>
                                <label htmlFor="notes" style={{ fontSize: '0.75rem', fontWeight: 500, color: '#4b5563', marginBottom: '0.25rem', display: 'block' }}>Describe concern</label>
                                <textarea
                                    id="notes" name="notes" placeholder="Describe concerns..."
                                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.5rem', fontSize: '0.875rem', resize: 'vertical', minHeight: '6rem' }}
                                    rows={3} value={formData.notes} onChange={handleFormChange}
                                />
                            </div>
                        </CollapsibleSection>

                        {/* Section 3: Select Date and Time */}
                        <CollapsibleSection title="Select date and time" defaultOpen={true}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', fontWeight: 600 }}>
                                <button type="button" style={{ color: '#9ca3af', border: 'none', background: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }}>‹</button>
                                <span>December</span>
                                <button type="button" style={{ color: '#9ca3af', border: 'none', background: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }}>›</button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '4px' }}>
                                <DateButton day="Mon" date={10} active={isTimeActive("Dec 10th 2025")} />
                                <DateButton day="Tue" date={11} />
                                <DateButton day="Wed" date={12} />
                                <DateButton day="Thu" date={13} />
                                <DateButton day="Fri" date={14} />
                                <DateButton day="Sat" date={15} />
                                <DateButton day="Sun" date={16} />
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.5rem' }}>
                                <TimeButton time="10:00 AM" active={isTimeActive("10:00 AM")} onClick={() => handleTimeSelect("10:00 AM")} />
                                <TimeButton time="10:30 AM" active={isTimeActive("10:30 AM")} onClick={() => handleTimeSelect("10:30 AM")} />
                                <TimeButton time="11:00 AM" active={isTimeActive("11:00 AM")} onClick={() => handleTimeSelect("11:00 AM")} />
                                <TimeButton time="11:30 AM" active={isTimeActive("11:30 AM")} onClick={() => handleTimeSelect("11:30 AM")} />
                                <TimeButton time="02:00 PM" active={isTimeActive("02:00 PM")} onClick={() => handleTimeSelect("02:00 PM")} />
                                <TimeButton time="02:30 PM" active={isTimeActive("02:30 PM")} onClick={() => handleTimeSelect("02:30 PM")} />
                                <TimeButton time="03:00 PM" active={isTimeActive("03:00 PM")} onClick={() => handleTimeSelect("03:00 PM")} />
                                <TimeButton time="04:00 PM" active={isTimeActive("04:00 PM")} onClick={() => handleTimeSelect("04:00 PM")} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem', paddingTop: '1rem' }}>
                                <FormInput
                                    label="Date"
                                    name="date"
                                    defaultValue={formData.date}
                                    onChange={handleFormChange}
                                />
                                <FormInput
                                    label="Time"
                                    name="time"
                                    defaultValue={formData.time}
                                    onChange={handleFormChange}
                                />
                            </div>
                        </CollapsibleSection>

                        {/* Section 4: Staff Details */}
                        <CollapsibleSection title="Staff details" defaultOpen={true}>
                            <div style={{ border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <FormSelect
                                    label="Lead"
                                    name="leadDoctor"
                                    options={mockData.doctors}
                                    defaultValue={formData.staff.find(m => m.role === 'Lead')?.name}
                                    onChange={handleFormChange}
                                />

                                {formData.staff.filter(m => m.role !== 'Lead').map((member) => (
                                    <StaffMember
                                        key={member.role}
                                        member={member}
                                        onRemove={() => handleRemoveStaff(member.name)}
                                    />
                                ))}
                                {/* <button type="button" style={{ color: '#2563eb', fontSize: '0.875rem', transition: 'color 0.15s ease', paddingTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px', border: 'none', background: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}>
                                    + Add Staff
                                </button> */}
                            </div>
                        </CollapsibleSection>

                        {/* Section 5: Billable Services */}
                        <CollapsibleSection title="Billable services" defaultOpen={true}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {formData.services.map(service => (
                                    <BillableServiceCard
                                        key={service.id}
                                        service={service}
                                        onRemove={() => handleRemoveService(service.id)}
                                    />
                                ))}

                            </div>
                        </CollapsibleSection>

                        <div style={{marginTop:20, alignItems: 'center', }}>
                            <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: '#4b5563', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    name="isEmergency"
                                    style={{ marginRight: '0.5rem', color: '#2563eb', borderRadius: '0.25rem' }}
                                    checked={formData.isEmergency}
                                    onChange={handleFormChange}
                                />
                                I confirm this is <p style={{color:"blue", position:"relative", top:8, left:5}}> an emergency.</p>
                            </label>

                            <button
                                type="submit"
                                style={{ padding: '0.625rem 1.5rem', width: "100%", marginTop: 20, backgroundColor: '#1f2937', color: 'white', borderRadius: '0.5rem', fontWeight: 500, transition: 'background-color 0.15s ease' }}
                            >
                                Book appointment
                            </button>
                        </div>

                    </div>

                </form>
            </div>
            
        </div>
    );
};

export default AddAppointmentModal;
// after book appointment btn, the detail modal  should open