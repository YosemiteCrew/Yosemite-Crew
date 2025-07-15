import { Appointment, Bundle, Extension, Participant, Practitioner } from "./types/fhirTypes"; // Define your custom types if needed

// Interface for input FHIR Appointment Resource (simplified for this case)
interface FHIRAppointmentResource {
  participant?: {
    actor?: {
      reference?: string;
      display?: string;
    };
  }[];
  extension?: {
    url: string;
    valueString?: string;
    valueBoolean?: boolean;
    extension?: {
      url: string;
      valueString?: string;
      valueBoolean?: boolean;
    }[];
  }[];
  reasonCode?: { text?: string }[];
}

// Interface for normalized appointment data
export interface NormalAppointmentData {
  hospitalId: string;
  HospitalName: string;
  ownerName: string;
  phone: string;
  addressline1: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  petName: string;
  petAge: string;
  petType: string;
  gender: string;
  breed: string;
  purposeOfVisit: string;
  appointmentType: string;
  appointmentSource: string;
  department: string;
  veterinarian: string;
  appointmentDate: string;
  day: string;
  timeSlots: {
    time: string;
    time24: string;
    _id: string;
    isBooked: boolean;
    selected: boolean;
  }[];
}

export class FHIRToNormalConverter {
  private fhirData: FHIRAppointmentResource;

  constructor(fhirData: FHIRAppointmentResource) {
    this.fhirData = fhirData;
  }

  convertToNormal(): NormalAppointmentData {
    const resource = this.fhirData;

    const getExtVal = (url: string): string =>
      resource.extension?.find((ext) => ext.url === url)?.valueString || "";

    const hospitalParticipant = resource.participant?.find((p) =>
      p.actor?.reference?.startsWith("Organization/")
    );
    const hospitalId = hospitalParticipant?.actor?.reference?.split("/")[1] || "";
    const HospitalName = hospitalParticipant?.actor?.display || "";

    const ownerParticipant = resource.participant?.find((p) =>
      p.actor?.reference?.startsWith("Patient/")
    );
    const ownerName = ownerParticipant?.actor?.display || "";

    const vetParticipant = resource.participant?.find((p) =>
      p.actor?.reference?.startsWith("Practitioner/")
    );
    const veterinarian = vetParticipant?.actor?.display || "";

    const appointmentDate = getExtVal("http://example.com/fhir/StructureDefinition/appointment-date");
    const day = appointmentDate
      ? new Date(appointmentDate).toLocaleDateString("en-US", { weekday: "long" })
      : "Invalid Date";

    const timeSlots =
      resource.extension
        ?.find((ext) => ext.url === "http://example.com/fhir/StructureDefinition/time-slots")
        ?.extension?.map((slot) => ({
          time: slot.extension?.find((ext) => ext.url === "time")?.valueString || "",
          time24: slot.extension?.find((ext) => ext.url === "time24")?.valueString || "",
          _id: slot.extension?.find((ext) => ext.url === "_id")?.valueString || "",
          isBooked: slot.extension?.find((ext) => ext.url === "isBooked")?.valueBoolean || false,
          selected: slot.extension?.find((ext) => ext.url === "selected")?.valueBoolean || false,
        })) || [];

    return {
      hospitalId,
      HospitalName,
      ownerName,
      phone: getExtVal("http://example.com/fhir/StructureDefinition/phone"),
      addressline1: getExtVal("http://example.com/fhir/StructureDefinition/address-line1"),
      street: getExtVal("http://example.com/fhir/StructureDefinition/street"),
      city: getExtVal("http://example.com/fhir/StructureDefinition/city"),
      state: getExtVal("http://example.com/fhir/StructureDefinition/state"),
      zipCode: getExtVal("http://example.com/fhir/StructureDefinition/zip-code"),
      petName: getExtVal("http://example.com/fhir/StructureDefinition/pet-name"),
      petAge: getExtVal("http://example.com/fhir/StructureDefinition/pet-age"),
      petType: getExtVal("http://example.com/fhir/StructureDefinition/pet-type"),
      gender: getExtVal("http://example.com/fhir/StructureDefinition/gender"),
      breed: getExtVal("http://example.com/fhir/StructureDefinition/breed"),
      purposeOfVisit: resource.reasonCode?.[0]?.text || "",
      appointmentType: getExtVal("http://example.com/fhir/StructureDefinition/appointment-type"),
      appointmentSource: getExtVal("http://example.com/fhir/StructureDefinition/appointment-source") || "In-Hospital",
      department: getExtVal("http://example.com/fhir/StructureDefinition/department"),
      veterinarian,
      appointmentDate,
      day,
      timeSlots,
    };
  }
}

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< APPOINTMENT FHIR CONVERTER >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

interface AppointmentInput {
  _id: string;
  ownerName?: string;
  veterinarian?: string;
  petName?: string;
  petType?: string;
  breed?: string;
  appointmentDate: string;
  appointmentTime: string;
  purposeOfVisit?: string;
  appointmentType?: string;
  slotsId?: string;
  department?: string;
  appointmentSource?: string;
  appointmentStatus?: string;
  tokenNumber?: string;
}

interface DoctorAppointmentSummary {
  doctorId: string;
  doctorName: string;
  image: string;
  department: string;
  totalAppointments: number;
}

interface AppointmentListData {
  Appointments: AppointmentInput[];
  total: number;
}

export class AppointmentFHIRConverter {
  appointment: AppointmentInput;
  totalAppointments: DoctorAppointmentSummary[];
  page: number;
  totalPages: number;
  totalCount: number;

  constructor(appointment: any) {
    this.appointment = appointment;
    this.totalAppointments = appointment.totalAppointments || [];
    this.page = appointment.page || 1;
    this.totalPages = appointment.totalPages || 1;
    this.totalCount = appointment.totalCount || 0;
  }

  toFHIR(): Appointment {
    const appointmentDateTime = this.parseAppointmentDateTime(
      this.appointment.appointmentDate,
      this.appointment.appointmentTime
    );

    return {
      resourceType: "Appointment",
      id: this.appointment._id.toString(),
      status: this.appointment.appointmentStatus || "unknown",
      serviceType: [{ text: this.appointment.purposeOfVisit || "Unknown" }],
      start: appointmentDateTime,
      participant: this.getParticipants(),
      reasonCode: [{ text: this.appointment.appointmentType || "Unknown" }],
      description: this.getDescription(),
      petType: this.getPetType(),
      slot: [{ reference: `${this.appointment.slotsId}` }],
      specialty: [{ text: this.appointment.department || "General" }],
      extension: this.getExtensions(),
    };
  }

  parseAppointmentDateTime(dateString: string, timeString: string): string {
    const formattedDate = this.formatAppointmentDate(dateString);
    const dateTimeString = `${formattedDate} ${timeString}`;
    const appointmentDate = new Date(dateTimeString);

    if (isNaN(appointmentDate.getTime())) {
      throw new Error("Invalid appointment date or time format");
    }

    return appointmentDate.toISOString();
  }

  formatAppointmentDate(dateString: string): string {
    const [day, monthStr, year] = dateString.split(" ");
    const month = this.getMonthNumber(monthStr);
    return `${year}-${month}-${day.padStart(2, "0")}`;
  }

  getMonthNumber(month: string): string {
    const months: Record<string, string> = {
      Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
      Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
    };
    return months[month] || "00";
  }

  getParticipants(): Participant[] {
    const participants: Participant[] = [];

    if (this.appointment.ownerName) {
      participants.push({
        actor: { display: this.appointment.ownerName },
        status: "accepted",
      });
    }

    if (this.appointment.veterinarian) {
      participants.push({
        actor: { display: this.appointment.veterinarian },
        status: "accepted",
      });
    }

    return participants;
  }

  getDescription(): string {
    return `Appointment for ${this.appointment.petName} (${this.appointment.petType}, ${this.appointment.breed})`;
  }
  getPetType(): string {
    return `${this.appointment.petType}`;
  }

  getExtensions(): Extension[] {
    const extensions: Extension[] = [];

    if (this.appointment.tokenNumber) {
      extensions.push({
        url: "http://example.com/fhir/StructureDefinition/tokenNumber",
        valueString: this.appointment.tokenNumber.toString(),
      });
    }

    if (this.appointment.appointmentSource) {
      extensions.push({
        url: "http://example.com/fhir/StructureDefinition/appointmentSource",
        valueString: this.appointment.appointmentSource,
      });
    }

    return extensions;
  }

  static convertAppointments(data: AppointmentListData): Bundle {
    return {
      resourceType: "Bundle",
      type: "collection",
      total: data.total,
      entry: data.Appointments.map((app) => ({
        resource: new AppointmentFHIRConverter(app).toFHIR(),
      })),
    };
  }

  toFHIRBundle(): Bundle {
    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "collection",
      total: this.totalCount,
      entry: [],
    };

    this.totalAppointments.forEach((docData) => {
      const practitionerId = `Practitioner/${docData.doctorId}`;
      const practitioner: Practitioner = {
        resourceType: "Practitioner",
        id: docData.doctorId,
        name: [{ text: docData.doctorName }],
        photo: [{ url: docData.image }],
      };

      bundle.entry.push({ resource: practitioner });

      for (let i = 0; i < docData.totalAppointments; i++) {
        const appointment: Appointment = {
          resourceType: "Appointment",
          id: `${docData.doctorId}-appointment-${i + 1}`,
          status: "booked",
          participant: [
            {
              actor: {
                reference: practitionerId,
                display: docData.doctorName,
              },
              status: "accepted",
            },
          ],
          specialty: [{ text: docData.department }],
        };
        bundle.entry.push({ resource: appointment });
      }
    });

    return bundle;
  }
}
