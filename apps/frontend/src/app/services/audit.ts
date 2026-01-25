import { AuditTrail } from "../types/audit";
import { getData } from "./axios";

export const getAppointmentAuditTrail = async (
  appointmentId: string,
): Promise<AuditTrail[]> => {
  try {
    if (!appointmentId) {
      throw new Error("Appointment ID missing");
    }
    const res = await getData<{ entries: AuditTrail[] }>(
      "/v1/audit-trail/appointment/" + appointmentId,
    );
    const entries = res.data.entries;
    return entries;
  } catch (err) {
    console.error("Failed to load audit trail:", err);
    throw err;
  }
};

export const getCompanionAuditTrail = async (
  companionId: string,
): Promise<AuditTrail[]> => {
  try {
    if (!companionId) {
      throw new Error("CompanionId ID missing");
    }
    const res = await getData<{ entries: AuditTrail[] }>(
      "/v1/audit-trail/companion/" + companionId,
    );
    const entries = res.data.entries;
    return entries;
  } catch (err) {
    console.error("Failed to load audit trail:", err);
    throw err;
  }
};
