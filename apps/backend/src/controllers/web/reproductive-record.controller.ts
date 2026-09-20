import { z } from "zod";
import {
  ReproductiveRecordService,
  ReproductiveRecordError,
} from "src/services/reproductive-record.service";
import {
  createClinicalHandlers,
  orgParams,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const ReproductiveStatusEnum = z.enum([
  "INTACT",
  "SPAYED",
  "NEUTERED",
  "CASTRATED",
  "UNKNOWN",
]);
const PregnancyStatusEnum = z.enum([
  "SUSPECTED",
  "CONFIRMED",
  "WHELPED",
  "QUEENED",
  "ABORTED",
  "RESORBED",
]);

const CreateBodySchema = z.object({
  patientId: z.uuid(),
  reproductiveStatus: ReproductiveStatusEnum,
  lastHeatDate: z.iso.datetime().optional(),
  nextHeatExpected: z.iso.datetime().optional(),
  matingDate: z.iso.datetime().optional(),
  sireId: z.uuid().optional(),
  sireName: z.string().max(300).optional(),
  pregnancyStatus: PregnancyStatusEnum.optional(),
  pregnancyConfirmedAt: z.iso.datetime().optional(),
  expectedWhelp: z.iso.datetime().optional(),
  litterSizeUltrasound: z.number().int().min(0).optional(),
  litterSizeXray: z.number().int().min(0).optional(),
  actualWhelp: z.iso.datetime().optional(),
  litterSizeBorn: z.number().int().min(0).optional(),
  litterSizeAlive: z.number().int().min(0).optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({ patientId: true }).partial();

const ListQuerySchema = z.object({
  patientId: z.uuid().optional(),
  reproductiveStatus: ReproductiveStatusEnum.optional(),
});

const RepParamsSchema = orgParams.extend({ recordId: uuid() });

const parseOptionalDate = (val?: string): Date | undefined =>
  val ? new Date(val) : undefined;

const { handler } = createClinicalHandlers(ReproductiveRecordError);

export const ReproductiveRecordController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list reproductive records",
    run: ({ params, input }) =>
      ReproductiveRecordService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create reproductive record",
    run: ({ params, input, userId }) => {
      const {
        lastHeatDate,
        nextHeatExpected,
        matingDate,
        pregnancyConfirmedAt,
        expectedWhelp,
        actualWhelp,
        ...rest
      } = input;
      return ReproductiveRecordService.create({
        organisationId: params.organisationId,
        recordedBy: userId,
        ...rest,
        lastHeatDate: parseOptionalDate(lastHeatDate),
        nextHeatExpected: parseOptionalDate(nextHeatExpected),
        matingDate: parseOptionalDate(matingDate),
        pregnancyConfirmedAt: parseOptionalDate(pregnancyConfirmedAt),
        expectedWhelp: parseOptionalDate(expectedWhelp),
        actualWhelp: parseOptionalDate(actualWhelp),
      });
    },
  }),

  get: handler({
    params: RepParamsSchema,
    fallback: "Failed to get reproductive record",
    run: ({ params }) =>
      ReproductiveRecordService.get(params.recordId, params.organisationId),
  }),

  update: handler({
    params: RepParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update reproductive record",
    run: ({ params, input, userId }) => {
      const {
        lastHeatDate,
        nextHeatExpected,
        matingDate,
        pregnancyConfirmedAt,
        expectedWhelp,
        actualWhelp,
        ...rest
      } = input;
      return ReproductiveRecordService.update(
        params.recordId,
        params.organisationId,
        {
          ...rest,
          lastHeatDate: parseOptionalDate(lastHeatDate),
          nextHeatExpected: parseOptionalDate(nextHeatExpected),
          matingDate: parseOptionalDate(matingDate),
          pregnancyConfirmedAt: parseOptionalDate(pregnancyConfirmedAt),
          expectedWhelp: parseOptionalDate(expectedWhelp),
          actualWhelp: parseOptionalDate(actualWhelp),
        },
        userId,
      );
    },
  }),
};
