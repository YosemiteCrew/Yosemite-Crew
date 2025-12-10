import { Appointment as FHIRAppointment } from "@yosemite-crew/fhirtypes";
import { Appointment, fromFHIRAppointment, toFHIRAppointment } from "../appointment";

export type AppointmentRequestDTO = FHIRAppointment;
export type AppointmentResponseDTO = FHIRAppointment;

export const fromAppointmentRequestDTO = (
  dto: AppointmentRequestDTO
) : Appointment => {
  if (!dto || dto.resourceType !== "Appointment") {
    throw new Error("Invalid payload. Expected FHIR Appointment resource.");
  }
  return fromFHIRAppointment(dto);
}

export const toAppointmentResponseDTO = (
  appointment: Appointment
) : AppointmentResponseDTO => {
  return toFHIRAppointment(appointment);
}