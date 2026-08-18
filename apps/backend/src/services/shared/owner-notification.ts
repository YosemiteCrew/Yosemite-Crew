import { prisma } from "src/config/prisma";
import { NotificationService } from "src/services/notification.service";
import type { NotificationPayload } from "src/utils/notificationTemplates";
import { sendEmail } from "src/utils/email";
import { resolvePublicPassportBaseUrl } from "src/utils/public-base-url";
import logger from "src/utils/logger";

// Everything the owner-facing channels need about a pet and the person
// responsible for it, resolved in one round trip.
export type PatientOwnerContact = {
  linkedUserId: string | null;
  email: string | null;
  patientName: string;
};

// Resolves the pet's PRIMARY/ACTIVE parent together with the pet's name.
// Returns null when the pet has no such owner link, or when the link points at
// rows that no longer exist - both mean "nobody to notify", not an error.
export const resolvePatientOwnerContact = async (
  patientId: string,
): Promise<PatientOwnerContact | null> => {
  const link = await prisma.parentPatient.findFirst({
    where: { patientId, role: "PRIMARY", status: "ACTIVE" },
    select: { parentId: true },
  });
  if (!link) return null;

  const [parent, patient] = await Promise.all([
    prisma.parent.findUnique({
      where: { id: link.parentId },
      select: { linkedUserId: true, email: true },
    }),
    prisma.patient.findUnique({
      where: { id: patientId },
      select: { name: true },
    }),
  ]);
  if (!parent || !patient) return null;

  return {
    linkedUserId: parent.linkedUserId,
    email: parent.email,
    patientName: patient.name,
  };
};

export type OwnerEmail = { subject: string; htmlBody: string };

export type OwnerEmailContext = {
  patientId: string;
  patientName: string;
  payload: NotificationPayload;
};

export type NotifyPatientOwnerOptions = {
  patientId: string;
  // Short flow name used to attribute best-effort failures in the logs,
  // e.g. "Passport-update".
  label: string;
  buildPayload: (patientName: string) => NotificationPayload;
  // Omit to fall back to a plain email that carries the push copy verbatim.
  buildEmail?: (context: OwnerEmailContext) => OwnerEmail;
};

// Best-effort owner notification shared by the passport and waitlist flows:
// pushes to the linked app user and emails the parent on file. Never throws and
// never blocks its caller - each channel failure is logged and swallowed so the
// clinical write that triggered the notification still succeeds.
export const notifyPatientOwner = async ({
  patientId,
  label,
  buildPayload,
  buildEmail,
}: NotifyPatientOwnerOptions): Promise<void> => {
  try {
    const owner = await resolvePatientOwnerContact(patientId);
    if (!owner) return;

    const payload = buildPayload(owner.patientName);

    if (owner.linkedUserId) {
      await NotificationService.sendToUser(owner.linkedUserId, payload).catch(
        (error: unknown) =>
          logger.error(`${label} push failed for patient ${patientId}`, error),
      );
    }

    if (owner.email) {
      const email = buildEmail
        ? buildEmail({ patientId, patientName: owner.patientName, payload })
        : { subject: payload.title, htmlBody: `<p>${payload.body}</p>` };
      await sendEmail({ to: owner.email, ...email }).catch((error: unknown) =>
        logger.error(`${label} email failed for patient ${patientId}`, error),
      );
    }
  } catch (error) {
    logger.error(`${label} owner notification failed`, { patientId, error });
  }
};

// Public passport deep link for a pet. The base is configurable so the same
// email works from local, dev and production hosts.
/**
 * Public passport deep link for a pet, or null when no absolute base URL is
 * configured.
 *
 * Returning null rather than a relative "/passport/<id>" is the point: the old
 * `??` chain treated the empty string shipped in `.env.example` as a configured
 * value and emitted a dead link into owner emails.
 */
export const publicPassportUrl = (patientId: string): string | null => {
  const base = resolvePublicPassportBaseUrl();
  if (!base) return null;
  return `${base}/passport/${patientId}`;
};

// Email shape shared by the passport flows: the push copy followed by a link
// into the pet's passport. Only the subject line differs between flows.
// A misconfigured deployment still gets the notification, just without the
// link - a dead anchor would be worse, and dropping the email entirely would
// cost the owner the news that their passport changed.
export const passportLinkEmail =
  (buildSubject: (patientName: string) => string) =>
  ({ patientId, patientName, payload }: OwnerEmailContext): OwnerEmail => {
    const url = publicPassportUrl(patientId);
    if (!url) {
      logger.error(
        "Passport link omitted from owner email: PUBLIC_PASSPORT_BASE_URL / PUBLIC_CARD_BASE_URL must be an absolute http(s) URL.",
        { patientId },
      );
    }
    const link = url
      ? `<p><a href="${url}">View ${patientName}'s passport</a></p>`
      : "";
    return {
      subject: buildSubject(patientName),
      htmlBody: `<p>${payload.body}</p>${link}`,
    };
  };
