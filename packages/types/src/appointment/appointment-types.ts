export interface IBookAppointmentRequestBody {
    data?: string;
}
export interface IParsedAppointmentDetails {
    appointmentDate: string;
    purposeOfVisit?: string;
    hospitalId: string;
    department: string;
    doctorId: string;
    petId: string;
    slotsId: string;
    timeslot: string;
    concernOfVisit?: string;
}
export interface IAppointmentData {
    userId: string;
    hospitalId: string;
    tokenNumber: string;
    department: string;
    veterinarian: string;
    petId: string;
    ownerName: string;
    petName: string;
    petAge: string;
    petType: string;
    gender: string;
    breed: string;
    day: string;
    appointmentDate: string;
    slotsId: string;
    appointmentTime: string;
    appointmentTime24: string;
    purposeOfVisit: string;
    concernOfVisit?: string;
    appointmentSource: string;
    document: string[];
}
export interface IFHIRAppointmentData {
    resourceType: "Appointment";
    start: number;
    reasonCode: Array<{
        text: string;
    }>;
    participant: Array<{
        actor: {
            reference: string;
            display: string;
        };
        status: string;
    }>;
    description: string;
    extension: Array<{
        url: string;
        valueString: string;
    }>;
    serviceType?: Array<{
        coding: Array<{
            code: string;
        }>;
    }>;
}
