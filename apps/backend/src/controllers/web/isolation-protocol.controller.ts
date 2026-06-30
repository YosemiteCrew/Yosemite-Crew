import { Request, Response } from "express";
import { z } from "zod";
import { IsolationProtocolService } from "src/services/isolation-protocol.service";

const ReasonEnum = z.enum([
  "PARVOVIRUS",
  "DISTEMPER",
  "RINGWORM",
  "MRSA",
  "RESPIRATORY_INFECTION",
  "GASTROINTESTINAL_INFECTION",
  "TICK_BORNE_DISEASE",
  "UNDIAGNOSED_CONTAGIOUS",
  "POST_OP_PRECAUTION",
  "OTHER",
]);

const LevelEnum = z.enum([
  "STANDARD",
  "CONTACT",
  "DROPLET",
  "AIRBORNE",
  "STRICT",
]);

const StartSchema = z.object({
  patientId: z.string(),
  reason: ReasonEnum.optional(),
  level: LevelEnum.optional(),
  unitId: z.string().optional(),
  startedAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v)),
  initiatedBy: z.string().optional(),
  ppe: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const EndSchema = z.object({
  endedAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v)),
  endedBy: z.string().optional(),
  notes: z.string().optional(),
});

const UpdateSchema = z.object({
  level: LevelEnum.optional(),
  ppe: z.array(z.string()).optional(),
  notes: z.string().optional(),
  unitId: z.string().optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().optional(),
  active: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  reason: ReasonEnum.optional(),
});

export const IsolationProtocolController = {
  start: async (req: Request, res: Response) => {
    const parsed = StartSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const protocol = await IsolationProtocolService.start({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.status(201).json(protocol);
  },

  get: async (req: Request, res: Response) => {
    const protocol = await IsolationProtocolService.get(
      req.params.protocolId,
      req.params.organisationId,
    );
    return res.json(protocol);
  },

  list: async (req: Request, res: Response) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const results = await IsolationProtocolService.list({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.json(results);
  },

  end: async (req: Request, res: Response) => {
    const parsed = EndSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const protocol = await IsolationProtocolService.end(
      req.params.protocolId,
      req.params.organisationId,
      parsed.data,
    );
    return res.json(protocol);
  },

  update: async (req: Request, res: Response) => {
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const protocol = await IsolationProtocolService.update(
      req.params.protocolId,
      req.params.organisationId,
      parsed.data,
    );
    return res.json(protocol);
  },
};
