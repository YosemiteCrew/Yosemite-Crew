import type { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";

// Consent templates saved before CONSENT was a storage kind are still stored
// as FORM; the form builder's category is what still marks them as consent.
const LEGACY_CONSENT_CATEGORY = "Consent form";

type TemplateSignerRules = { kind: string; rules: unknown };

const readRecordField = (value: unknown, key: string): unknown =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined;

/** A consent template, including one saved as FORM before CONSENT existed. */
export const isConsentTemplate = (template: TemplateSignerRules): boolean =>
  template.kind === "CONSENT" ||
  (template.kind === "FORM" &&
    readRecordField(template.rules, "category") === LEGACY_CONSENT_CATEGORY);

/**
 * Whether the client signs what is filled in from this template: the signer
 * the form builder names (`rules.requiredSigner`), or, when it names none, a
 * consent. A template signed by the practice, or by no one, is not.
 */
export const templateNeedsClientSignature = (
  template: TemplateSignerRules,
): boolean => {
  const signer = readRecordField(template.rules, "requiredSigner");
  if (typeof signer === "string" && signer.trim()) {
    return signer.trim().toUpperCase() === "CLIENT";
  }
  return isConsentTemplate(template);
};

/**
 * Serialises the writes that decide where a client's request for one form on
 * one appointment stands: a submission of the form and a signature on it
 * completing. Held until the caller's transaction ends.
 */
export const lockClientRequest = async (
  tx: Pick<Prisma.TransactionClient, "$executeRaw">,
  request: {
    organisationId: string;
    templateId: string;
    appointmentId: string;
  },
): Promise<void> => {
  const key = [
    "client-form-request",
    request.organisationId,
    request.templateId,
    request.appointmentId,
  ].join(":");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
};

type ClientSignableDocument = {
  id: string;
  kind: string;
  organisationId: string;
  templateId: string | null;
  templateInstanceId: string | null;
};

const requestKey = (
  organisationId: string,
  templateId: string,
  appointmentId: string,
) => [organisationId, templateId, appointmentId].join(":");

/**
 * The documents among these that wait for the client's own signature: a
 * consent, or a form from a template the client signs that the practice asked
 * them to sign on its appointment. Practice staff never sign them, and the
 * discharge packet never marks them signed. Two queries however many
 * documents there are.
 */
export const loadDocumentsAwaitingClientSignature = async (
  documents: ClientSignableDocument[],
): Promise<Set<string>> => {
  const awaiting = new Set(
    documents.filter(({ kind }) => kind === "CONSENT").map(({ id }) => id),
  );
  const forms = documents.filter(
    (document) =>
      !awaiting.has(document.id) &&
      document.templateId &&
      document.templateInstanceId,
  );
  if (!forms.length) return awaiting;

  const instances = await prisma.templateInstance.findMany({
    where: { id: { in: forms.map((form) => String(form.templateInstanceId)) } },
    select: {
      id: true,
      appointmentId: true,
      template: { select: { kind: true, rules: true } },
    },
  });
  const clientSigned = new Map(
    instances
      .filter(
        (instance) =>
          instance.appointmentId &&
          templateNeedsClientSignature(instance.template),
      )
      .map((instance) => [instance.id, String(instance.appointmentId)]),
  );
  const candidates = forms.filter((form) =>
    clientSigned.has(String(form.templateInstanceId)),
  );
  if (!candidates.length) return awaiting;

  const requests = await prisma.formAssignment.findMany({
    where: {
      organisationId: {
        in: [...new Set(candidates.map((c) => c.organisationId))],
      },
      templateId: {
        in: [...new Set(candidates.map((c) => String(c.templateId)))],
      },
      appointmentId: { in: [...new Set(clientSigned.values())] },
      signingRequired: true,
      status: { notIn: ["CANCELLED", "EXPIRED"] },
    },
    select: { organisationId: true, templateId: true, appointmentId: true },
  });
  const requested = new Set(
    requests.map((request) =>
      requestKey(
        request.organisationId,
        request.templateId,
        String(request.appointmentId),
      ),
    ),
  );
  for (const form of candidates) {
    const appointmentId = String(
      clientSigned.get(String(form.templateInstanceId)),
    );
    if (
      requested.has(
        requestKey(form.organisationId, String(form.templateId), appointmentId),
      )
    ) {
      awaiting.add(form.id);
    }
  }
  return awaiting;
};

/** Whether this one document waits for the client's own signature. */
export const awaitsClientSignature = async (
  document: ClientSignableDocument,
): Promise<boolean> =>
  (await loadDocumentsAwaitingClientSignature([document])).has(document.id);

// A claim whose request never finished (the process stopped between claiming
// and sending) stops blocking the document after this long.
const SIGNING_CLAIM_TTL_MS = 5 * 60 * 1000;

/**
 * Whether a signing is under way: one sent to Documenso, or claimed moments
 * ago by a request that is sending it now.
 */
export const isOpenSigning = (value: unknown): boolean => {
  if (readRecordField(value, "status") !== "IN_PROGRESS") return false;
  if (readRecordField(value, "documentId")) return true;
  const claimedAtValue = readRecordField(value, "claimedAt");
  const claimedAt =
    typeof claimedAtValue === "string"
      ? Date.parse(claimedAtValue)
      : Number.NaN;
  return (
    Number.isFinite(claimedAt) && Date.now() - claimedAt < SIGNING_CLAIM_TTL_MS
  );
};

/**
 * Whether a document is signed or out for signature, which holds its record
 * against in-place edits. A claim left by a request that never sent anything
 * expires as it does for signing, so it does not hold the record for good.
 */
export const hasActiveOrCompletedSigning = (document: {
  status: string;
  signing: unknown;
}): boolean =>
  document.status === "SIGNED" ||
  readRecordField(document.signing, "status") === "SIGNED" ||
  isOpenSigning(document.signing);
