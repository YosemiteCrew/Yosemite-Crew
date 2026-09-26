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
 * consent or form whose template the client signs (a consent that names no
 * signer included), a form only where the practice asked the client to sign
 * it on its appointment. A consent with no template to read is the client's.
 * Practice staff never sign these, and the discharge packet never marks them
 * signed. Two queries however many documents there are.
 */
export const loadDocumentsAwaitingClientSignature = async (
  documents: ClientSignableDocument[],
): Promise<Set<string>> => {
  const hasTemplate = (document: ClientSignableDocument) =>
    Boolean(document.templateId && document.templateInstanceId);
  const awaiting = new Set(
    documents
      .filter(
        (document) => document.kind === "CONSENT" && !hasTemplate(document),
      )
      .map(({ id }) => id),
  );
  const templated = documents.filter(hasTemplate);
  if (!templated.length) return awaiting;

  const instances = await prisma.templateInstance.findMany({
    where: {
      id: {
        in: templated.map((document) => String(document.templateInstanceId)),
      },
    },
    select: {
      id: true,
      appointmentId: true,
      template: { select: { kind: true, rules: true } },
    },
  });
  const clientSigned = new Map(
    instances
      .filter((instance) => templateNeedsClientSignature(instance.template))
      .map((instance) => [instance.id, instance.appointmentId]),
  );
  const signedByClient = templated.filter((document) =>
    clientSigned.has(String(document.templateInstanceId)),
  );
  for (const document of signedByClient) {
    if (document.kind === "CONSENT") awaiting.add(document.id);
  }

  // A form is the client's only where the practice asked them for it.
  const candidates = signedByClient.filter(
    (document) =>
      document.kind !== "CONSENT" &&
      clientSigned.get(String(document.templateInstanceId)),
  );
  if (!candidates.length) return awaiting;

  const appointmentOf = (document: ClientSignableDocument) =>
    String(clientSigned.get(String(document.templateInstanceId)));
  const requests = await prisma.formAssignment.findMany({
    where: {
      organisationId: {
        in: [...new Set(candidates.map((c) => c.organisationId))],
      },
      templateId: {
        in: [...new Set(candidates.map((c) => String(c.templateId)))],
      },
      appointmentId: { in: [...new Set(candidates.map(appointmentOf))] },
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
    if (
      requested.has(
        requestKey(
          form.organisationId,
          String(form.templateId),
          appointmentOf(form),
        ),
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

/**
 * What a practice save means for the request sent to the client for a form on
 * an appointment, written in the save's transaction:
 * - one the client does not sign is answered by the practice filling it in;
 * - one the client signs stays open for them, and a signature they gave on an
 *   earlier practice version no longer answers it, since the new version is
 *   the one they now sign. Their own signed submission still does.
 */
export const settleClientRequestAfterPracticeSave = async (
  tx: Pick<
    Prisma.TransactionClient,
    "formAssignment" | "templateInstance" | "parent"
  >,
  request: {
    organisationId: string;
    templateId: string;
    appointmentId: string;
  },
  clientSigns: boolean,
): Promise<void> => {
  await tx.formAssignment.updateMany({
    where: {
      ...request,
      status: { in: ["SENT", "VIEWED"] },
      ...(clientSigns ? { signingRequired: false } : {}),
    },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });

  if (!clientSigns) return;

  const signedAuthors = await tx.templateInstance.findMany({
    where: { ...request, status: "SIGNED", authorId: { not: null } },
    select: { authorId: true },
  });
  const clientSignedTheirOwn =
    signedAuthors.length > 0 &&
    (await tx.parent.count({
      where: {
        id: { in: signedAuthors.map(({ authorId }) => String(authorId)) },
      },
    })) > 0;
  if (clientSignedTheirOwn) return;

  await tx.formAssignment.updateMany({
    where: { ...request, status: "SIGNED", signingRequired: true },
    data: { status: "SENT", signedAt: null },
  });
};

// A claim whose request never finished (the process stopped between claiming
// and sending) stops blocking the document after this long.
const SIGNING_CLAIM_TTL_MS = 5 * 60 * 1000;

/**
 * Whether a signing is under way: one sent to the signer, or claimed (or
 * recorded but not yet sent) moments ago by a request that is sending it now.
 */
export const isOpenSigning = (value: unknown): boolean => {
  if (readRecordField(value, "status") !== "IN_PROGRESS") return false;
  // Sent to the signer: open until Documenso reports it signed or withdrawn.
  if (
    readRecordField(value, "documentId") &&
    readRecordField(value, "awaitingSend") !== true
  ) {
    return true;
  }
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
