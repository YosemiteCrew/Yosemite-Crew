import { z } from "zod";
import {
  PatientConsentService,
  PatientConsentError,
} from "src/services/patient-consent.service";
import {
  createClinicalHandlers,
  orgParams,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const ConsentTypeEnum = z.enum([
  "SURGICAL",
  "ANESTHESIA",
  "DIAGNOSTIC",
  "TREATMENT",
  "DATA_SHARING",
  "DNR",
  "OTHER",
]);
const ConsentStatusEnum = z.enum(["ACTIVE", "REVOKED", "EXPIRED"]);

const GrantBodySchema = z.object({
  patientId: z.string().uuid(),
  consentType: ConsentTypeEnum,
  procedureDesc: z.string().max(2000).optional(),
  // `consentedBy` is deliberately NOT accepted from the body: the service uses
  // it as the CONSENT_GRANTED audit actor, so it may only ever come from the
  // authenticated session. `consentedByName` is the free-text human field.
  consentedByName: z.string().max(200).optional(),
  consentedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  witnessedBy: z.string().max(200).optional(),
  documentId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

const RevokeBodySchema = z.object({
  revokedReason: z.string().max(2000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  status: ConsentStatusEnum.optional(),
  consentType: ConsentTypeEnum.optional(),
});

const ConsentParamsSchema = orgParams.extend({ consentId: uuid() });

const { handler } = createClinicalHandlers(PatientConsentError);

export const PatientConsentController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list consents",
    run: ({ params, input }) =>
      PatientConsentService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  grant: handler({
    params: orgParams,
    body: GrantBodySchema,
    status: 201,
    fallback: "Failed to grant consent",
    run: ({ params, input, userId }) => {
      const { consentedAt, expiresAt, ...rest } = input;
      return PatientConsentService.grant({
        organisationId: params.organisationId,
        ...rest,
        ...(userId ? { consentedBy: userId } : {}),
        ...(consentedAt ? { consentedAt: new Date(consentedAt) } : {}),
        ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
      });
    },
  }),

  get: handler({
    params: ConsentParamsSchema,
    fallback: "Failed to get consent",
    run: ({ params }) =>
      PatientConsentService.get(params.consentId, params.organisationId),
  }),

  revoke: handler({
    params: ConsentParamsSchema,
    body: RevokeBodySchema,
    fallback: "Failed to revoke consent",
    run: ({ params, input, userId }) =>
      PatientConsentService.revoke(
        params.consentId,
        params.organisationId,
        input.revokedReason,
        userId,
      ),
  }),
};
