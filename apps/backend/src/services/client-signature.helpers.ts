import type { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";

// Consent templates saved before CONSENT was a storage kind are still stored
// as FORM; the form builder's category is what still marks them as consent.
const LEGACY_CONSENT_CATEGORY = "Consent form";

type TemplateSignerRules = { kind: string; rules: unknown };

export const readRecordField = (value: unknown, key: string): unknown =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined;

/** A consent template, including one saved as FORM before CONSENT existed. */
export const isConsentTemplate = (template: TemplateSignerRules): boolean =>
  template.kind === "CONSENT" ||
  (template.kind === "FORM" &&
    readRecordField(template.rules, "category") === LEGACY_CONSENT_CATEGORY);

/** Who signs what is filled in from a template. */
export type DocumentSigner = "CLIENT" | "VET" | "NONE";

/**
 * Who signs what is filled in from this template: the signer the form builder
 * names (`rules.requiredSigner`: CLIENT, VET, or NONE for no signature), or,
 * when it names none, the client for a consent and no one otherwise.
 */
export const resolveTemplateSigner = (
  template: TemplateSignerRules,
): DocumentSigner => {
  const signer = readRecordField(template.rules, "requiredSigner");
  if (typeof signer === "string" && signer.trim()) {
    const named = signer.trim().toUpperCase();
    return named === "CLIENT" || named === "VET" ? named : "NONE";
  }
  return isConsentTemplate(template) ? "CLIENT" : "NONE";
};

/** Whether the client signs what is filled in from this template. */
export const templateNeedsClientSignature = (
  template: TemplateSignerRules,
): boolean => resolveTemplateSigner(template) === "CLIENT";

/**
 * Who signs this submitted instance. The signer is pinned on the instance when
 * it is submitted, so a later edit to the template does not change who signs
 * what was already submitted; an instance submitted before the signer was
 * pinned falls back to its template. `null` with neither to read.
 */
export const resolveInstanceSigner = (instance: {
  generatedPdf?: unknown;
  template: TemplateSignerRules | null;
}): DocumentSigner | null => {
  const pinned = readRecordField(instance.generatedPdf, "signer");
  if (pinned === "CLIENT" || pinned === "VET" || pinned === "NONE") {
    return pinned;
  }
  return instance.template ? resolveTemplateSigner(instance.template) : null;
};

/** Whether the client signs this submitted instance. */
export const instanceNeedsClientSignature = (instance: {
  generatedPdf?: unknown;
  template: TemplateSignerRules | null;
}): boolean => resolveInstanceSigner(instance) === "CLIENT";

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

/** A submitted form on an appointment, as the requests it may answer see it. */
export type AnsweringInstance = {
  organisationId: string;
  templateId: string;
  appointmentId: string;
  authorId: string | null;
  createdAt: Date;
};

const WITHDRAWN_REQUEST_STATUSES: Prisma.FormAssignmentWhereInput["status"] = {
  in: ["CANCELLED", "EXPIRED"],
};

/**
 * The open requests for its form on its appointment that a submitted form
 * answers, as a where clause, or `null` when it answers none. The practice's
 * answers answer any open request. A parent's answers answer only a request
 * sent at or before they gave them, and none once a request was withdrawn
 * after they gave them: answers given to a withdrawn request never answer the
 * one sent after it.
 */
export const requestsAnsweredBy = async (
  client: Pick<Prisma.TransactionClient, "formAssignment" | "parent">,
  instance: AnsweringInstance,
): Promise<Prisma.FormAssignmentWhereInput | null> => {
  const request = {
    organisationId: instance.organisationId,
    templateId: instance.templateId,
    appointmentId: instance.appointmentId,
  };
  const open: Prisma.FormAssignmentWhereInput = {
    ...request,
    status: { notIn: ["CANCELLED", "EXPIRED"] },
  };
  const byParent =
    !!instance.authorId &&
    (await client.parent.count({ where: { id: instance.authorId } })) > 0;
  if (!byParent) return open;

  const withdrawnSince = await client.formAssignment.count({
    where: {
      ...request,
      status: WITHDRAWN_REQUEST_STATUSES,
      OR: [
        { cancelledAt: { gt: instance.createdAt } },
        { expiredAt: { gt: instance.createdAt } },
      ],
    },
  });
  if (withdrawnSince > 0) return null;
  return { ...open, createdAt: { lte: instance.createdAt } };
};

/**
 * The one parent who signs a client-signed form on its appointment: the parent
 * who filled it in, or else, for answers the practice gave, the parent the
 * request names, by default the companion's primary parent. `null` when there
 * is none. Any other parent, a co-parent who may read it included, never signs
 * it.
 */
export const pickNamedClientSigner = (named: {
  authorId: string | null;
  authorIsParent: boolean;
  requestSignerId?: string | null;
  primaryParentId?: string | null;
}): string | null => {
  if (named.authorId && named.authorIsParent) return named.authorId;
  return named.requestSignerId || named.primaryParentId || null;
};

/** `pickNamedClientSigner`, reading who the author and primary parent are. */
export const resolveNamedClientSigner = async (
  client: Pick<Prisma.TransactionClient, "parent" | "parentPatient">,
  answers: { authorId: string | null; patientId?: string | null },
  request: { signerUserId?: string | null } | null,
): Promise<string | null> => {
  const authorIsParent =
    !!answers.authorId &&
    (await client.parent.count({ where: { id: answers.authorId } })) > 0;
  if (authorIsParent || request?.signerUserId || !answers.patientId) {
    return pickNamedClientSigner({
      authorId: answers.authorId,
      authorIsParent,
      requestSignerId: request?.signerUserId,
    });
  }
  const primary = await client.parentPatient.findFirst({
    where: { patientId: answers.patientId, role: "PRIMARY", status: "ACTIVE" },
    select: { parentId: true },
  });
  return pickNamedClientSigner({
    authorId: answers.authorId,
    authorIsParent,
    primaryParentId: primary?.parentId,
  });
};

/**
 * When the last request for each form on an appointment was withdrawn: a
 * parent's answers given before then answer no request. A form with no
 * withdrawn request has no cut-off.
 */
export const withdrawalCutoffs = (
  requests: {
    templateId: string;
    cancelledAt?: Date | string | null;
    expiredAt?: Date | string | null;
  }[],
): Map<string, number> => {
  const cutoffs = new Map<string, number>();
  for (const request of requests) {
    const withdrawnAt = request.cancelledAt ?? request.expiredAt;
    if (!withdrawnAt) continue;
    const at = new Date(withdrawnAt).getTime();
    cutoffs.set(
      request.templateId,
      Math.max(at, cutoffs.get(request.templateId) ?? at),
    );
  }
  return cutoffs;
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
      generatedPdf: true,
      template: { select: { kind: true, rules: true } },
    },
  });
  const clientSigned = new Map(
    instances
      .filter((instance) => instanceNeedsClientSignature(instance))
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
