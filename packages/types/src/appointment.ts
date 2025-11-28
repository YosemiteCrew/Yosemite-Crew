import { Appointment as FHIRAppointment, AppointmentParticipant, CodeableConcept, Extension } from "@yosemite-crew/fhirtypes";
import dayjs from "dayjs";
import { SPECIES_SYSTEM_URL } from "./companion";

export type AppointmentStatus =
  | 'NO_PAYMENT'
  | 'REQUESTED'
  | 'UPCOMING'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type Appointment = {
  id?: string;
  companion: {
    id: string;
    name: string;
    species: string;
    breed?: string;
    parent: {
      id: string;
      name: string;
    };
  };
  lead?: {
    id: string;
    name: string;
  }                           // Vet or practitioner being booked
  supportStaff?: {
    id: string;
    name: string;
  }[]
  room?: {                     // Clinic room being booked
    id: string;
    name: string;
  }
  appointmentType? : {
    id: string;
    name: string;
    speciality: {
      id: string;
      name: string;
    }
  }
  organisationId: string;      // Org / clinic
  appointmentDate: Date;       // Date of the appointment
  startTime: Date;         // Booking start timestamp
  timeSlot: string;            // Time Slot for the appointment
  durationMinutes: number;     // Duration in minutes
  endTime: Date;               // Booking end timestamp
  status: AppointmentStatus;
  isEmergency?: boolean; 
  concern?: string;            // Reason for the appointment
  createdAt?: Date;
  updatedAt?: Date;
};

const BREED_SYSTEM_URL = 'http://hl7.org/fhir/animal-breed'
const EXT_EMERGENCY = 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-is-emergency'
const EXT_PRICING = 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-pricing';


export function toFHIRAppointment(appointment: Appointment): FHIRAppointment {
  const participants: AppointmentParticipant[] = [];

  // Companion participant
  participants.push(
    {
      actor: {
        reference: `Patient/${appointment.companion.id}`,
        display: appointment.companion.name,
      },
    },
    {
      actor: {
        reference: `RelatedPerson/${appointment.companion.parent.id}`,
        display: appointment.companion.parent.name,
      },
    },
    {
      actor: {
        reference: `Practitioner/${appointment.lead?.id}`,
        display: appointment.lead?.name
      },
      status: appointment.status,
      type: [{coding: [{code: 'PPRF', system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', display: 'primary performer'}]}]
    },
    {
      actor: {
        reference: `Organization/${appointment.organisationId}`
      },
    }
  );

  // Support staff participants
  if (appointment.supportStaff && appointment.supportStaff.length > 0) {
    for(const staff of appointment.supportStaff) {
      participants.push({
        actor: {
          reference: `Practitioner/${staff.id}`,
          display: staff.name
        },
        status: 'accepted',
        type: [{coding: [{code: 'SPRF', system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', display: 'support performer'}]}]
      });
    }
  }

  // Room participant
  if (appointment.room) {
    participants.push({
      actor: {
        reference: `Location/${appointment.room.id}`,
        display: appointment.room.name
      },
      status: 'accepted',
      type: [{coding: [{code: 'LOC', system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', display: 'location'}]}]
    });
  }

  // Appointment Type as serviceType
  const serviceType : CodeableConcept[] = appointment.appointmentType ? [{
    coding: [{
      code: appointment.appointmentType.id,
      display: appointment.appointmentType.name,
      system: 'http://example.org/appointment-types'
    }],
    text: appointment.appointmentType.name
  }] : [];

  // Appointment speciality links to Speciality
  const speciality: CodeableConcept[] = appointment.appointmentType?.speciality
    ? [
        {
          coding: [
            {
              system: "http://yosemitecrew.com/fhir/specialty",
              code: appointment.appointmentType.speciality.id,
              display: appointment.appointmentType.speciality.name,
            },
          ],
        },
      ]
    : [];

  const fhirStatus = appointment.status

  const extension : Extension[] = []

  extension.push(
    {
      id: 'species',
      url: SPECIES_SYSTEM_URL,
      valueString: appointment.companion.species
    },
    {
      id: 'breed',
      url: BREED_SYSTEM_URL,
      valueString: appointment.companion.breed
    }
  );

  if (appointment.isEmergency != null) {
    extension.push({
      url: EXT_EMERGENCY,
      valueBoolean: appointment.isEmergency,
    });
  }

  const fhirAppointment: FHIRAppointment = {
    resourceType: "Appointment",
    id: appointment.id,
    status: fhirStatus,
    participant: participants,
    serviceType,
    speciality,
    start: dayjs(appointment.startTime).toISOString(),
    end: dayjs(appointment.endTime).toISOString(),
    minutesDuration: appointment.durationMinutes,
    description: appointment.concern,
    extension: extension
  };

  return fhirAppointment;
}

export function fromFHIRAppointment(FHIRappointment: FHIRAppointment): Appointment {
  
  const companionParticipant = FHIRappointment.participant.find(p => p.actor?.reference?.startsWith("Patient/"));
  const parentParticipant = FHIRappointment.participant.find(p => p.actor?.reference?.startsWith("RelatedPerson/"));
  const leadParticipant = FHIRappointment.participant.find(p => p.type?.some(t => t.coding?.some(c => c.code === 'PPRF')));
  const supportStaffParticipants = FHIRappointment.participant.filter(p => p.type?.some(t => t.coding?.some(c => c.code === 'SPRF')));
  const roomParticipant = FHIRappointment.participant.find(p => p.type?.some(t => t.coding?.some(c => c.code === 'LOC')));
  const orgParticipant = FHIRappointment.participant.find(p => p.actor?.reference?.startsWith("Organization/"));

  const appointmentTypeCoding = FHIRappointment.serviceType?.[0]?.coding?.[0] || undefined

  const specialityCoding = FHIRappointment.speciality?.[0]?.coding?.[0] || undefined;

  const speciesExtesnion = FHIRappointment.extension?.find(p => p.id?.includes("species"))
  const breedExtension = FHIRappointment.extension?.find(p => p.id?.includes("breed"))
  const emergencyExtension = FHIRappointment.extension?.find(p => p.url?.includes(EXT_EMERGENCY))
  const priceExtesnion = FHIRappointment.extension?.find(p => p.url?.includes(EXT_PRICING))

  const pmsStatus = FHIRappointment.status // fallback if unknown status

  let pricing : {
    baseCost: number;
    discountPercent?: number;
    finalCost: number;
    quantity: number;
  } | undefined;

  if(priceExtesnion?.extension?.length) {
    const getVal = (name: string) =>
      priceExtesnion.extension?.find((ex) => ex.url === name);

    pricing = {
      baseCost: getVal("baseCost")?.valueDecimal ?? 0,
      finalCost: getVal("finalCost")?.valueDecimal ?? 0,
      quantity: getVal("quantity")?.valueInteger ?? 1,
      discountPercent: getVal("discountPercent")?.valueDecimal,
    };
  }

  // Construct internal Appointment object
  const appointment: Appointment = {
    id: FHIRappointment.id ?? "",
    organisationId:
      orgParticipant?.actor?.reference?.split("/")[1] ?? "unknown-org",
    companion: {
      id: companionParticipant?.actor?.reference?.split("/")[1] ?? "unknown-pet",
      name: companionParticipant?.actor?.display ?? "",
      species: speciesExtesnion?.valueString || "",
      breed: breedExtension?.valueString || "",
      parent: {
        id: parentParticipant?.actor?.reference?.split("/")[1] ?? "unknown-owner",
        name: parentParticipant?.actor?.display ?? "",
      },
    },
    lead: {
      id: leadParticipant?.actor?.reference?.split("/")[1] ?? "",
      name: leadParticipant?.actor?.display ?? "",
    },
    supportStaff: supportStaffParticipants.map((s) => ({
      id: s.actor?.reference?.split("/")[1] ?? "",
      name: s.actor?.display ?? "",
    })),
    room: roomParticipant
      ? {
          id: roomParticipant.actor?.reference?.split("/")[1] ?? "",
          name: roomParticipant.actor?.display ?? "",
        }
      : undefined,
    appointmentDate: FHIRappointment.start ? new Date(FHIRappointment.start) : new Date(),
    timeSlot: dayjs(FHIRappointment.start).format("HH:mm"),
    durationMinutes: FHIRappointment.minutesDuration ?? 0,
    startTime: FHIRappointment.start ? new Date(FHIRappointment.start) : new Date(),
    endTime: FHIRappointment.end ? new Date(FHIRappointment.end) : new Date(),
    status: pmsStatus as any,
    concern: FHIRappointment.description ?? "",
    createdAt: FHIRappointment.created ? new Date(FHIRappointment.created) : new Date(),
    updatedAt: new Date(),
    appointmentType : {
      id : appointmentTypeCoding?.code ?? "general",
      name: appointmentTypeCoding?.display ?? "General Appointment",
      speciality : {
        id : specialityCoding?.code || "",
        name : specialityCoding?.display || ""
      }
    },
  }

  return appointment;
}