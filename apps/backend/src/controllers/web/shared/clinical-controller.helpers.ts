import type { Request, Response } from "express";
import { z } from "zod";
import type { OrgRequest } from "src/middlewares/rbac";

export type ServiceErrorLike = Error & { statusCode: number };

export type ServiceErrorClass = new (...args: never[]) => ServiceErrorLike;

export type ClinicalHandler = (
  req: Request,
  res: Response,
) => Promise<Response>;

/**
 * Bounded, lenient id validation for route params and scope ids.
 *
 * Ids in this system may be Mongo ObjectIds or Postgres UUIDs (dual-write), the
 * same rule the passport-family controllers document via `looseId` in
 * org-controller.helpers.ts. A strict `.uuid()` here 400s a 24-hex organisation
 * or companion id before the lookup runs, so the identical `:organisationId`
 * segment that works on /v1/pet-passport fails on every clinical route.
 * `.max(64)` keeps the bound that protects the ORM.
 *
 * Named `uuid` for historical reasons - it is the shared id validator, not a
 * UUID assertion. Existence is the data lookup's job (404), not the schema's.
 */
export const uuid = (): z.ZodString => z.string().min(1).max(64);

export const orgParams = z.object({ organisationId: uuid() });

/** The patient/encounter filters every clinical list endpoint accepts. */
export const patientScopeQuery = z.object({
  patientId: uuid().optional(),
  encounterId: uuid().optional(),
});

/**
 * The patient/encounter link every clinical create body carries: the patient is
 * mandatory, the encounter optional. Merge the record's own fields onto it so
 * the two keys keep leading the shape.
 */
export const patientScopeBody = z.object({
  patientId: uuid(),
  encounterId: uuid().optional(),
});

/**
 * Turns the optional `from`/`to` ISO strings of a list query into the Date
 * filters the services expect, omitting whichever bound was not supplied.
 */
export const dateRange = (from?: string, to?: string) => ({
  ...(from ? { from: new Date(from) } : {}),
  ...(to ? { to: new Date(to) } : {}),
});

export const coerceDateFields = (
  data: Record<string, unknown>,
  keys: readonly string[],
) => {
  const out = { ...data };
  for (const key of keys) {
    if (typeof out[key] === "string") out[key] = new Date(out[key] as string);
  }
  return out;
};

type SuccessStatus = 200 | 201 | 204;

type BaseConfig<P extends z.ZodTypeAny> = {
  params: P;
  status?: SuccessStatus;
  fallback: string;
};

type ParamsOnlyConfig<P extends z.ZodTypeAny> = BaseConfig<P> & {
  run: (ctx: { params: z.output<P>; userId: string | undefined }) => unknown;
};

type PayloadConfig<
  P extends z.ZodTypeAny,
  I extends z.ZodTypeAny,
> = BaseConfig<P> & {
  invalidInputMessage?: string;
  run: (ctx: {
    params: z.output<P>;
    input: z.output<I>;
    userId: string | undefined;
  }) => unknown;
};

type WithBodyConfig<
  P extends z.ZodTypeAny,
  I extends z.ZodTypeAny,
> = PayloadConfig<P, I> & { body: I };

type WithQueryConfig<
  P extends z.ZodTypeAny,
  I extends z.ZodTypeAny,
> = PayloadConfig<P, I> & { query: I };

/**
 * Builds the error handler and request handler factory shared by the clinical
 * CRUD controllers. Every handler validates route params first (400 with
 * "Invalid route parameters"), then the body or query payload, and finally
 * delegates the controller-specific work to `run`.
 */
export const createClinicalHandlers = (errorClass: ServiceErrorClass) => {
  const handleError = (
    err: unknown,
    res: Response,
    fallback: string,
  ): Response => {
    if (err instanceof errorClass) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    return res.status(500).json({ message: fallback });
  };

  function handler<P extends z.ZodTypeAny, I extends z.ZodTypeAny>(
    config: WithBodyConfig<P, I>,
  ): ClinicalHandler;
  function handler<P extends z.ZodTypeAny, I extends z.ZodTypeAny>(
    config: WithQueryConfig<P, I>,
  ): ClinicalHandler;
  function handler<P extends z.ZodTypeAny>(
    config: ParamsOnlyConfig<P>,
  ): ClinicalHandler;
  function handler<P extends z.ZodTypeAny, I extends z.ZodTypeAny>(
    config: ParamsOnlyConfig<P> | WithBodyConfig<P, I> | WithQueryConfig<P, I>,
  ): ClinicalHandler {
    return async (req: Request, res: Response): Promise<Response> => {
      try {
        const parsedParams = config.params.safeParse(req.params);
        if (!parsedParams.success)
          return res.status(400).json({ message: "Invalid route parameters" });
        const params = parsedParams.data as z.output<P>;
        const userId = (req as OrgRequest).userId ?? undefined;

        let result: unknown;
        if ("body" in config || "query" in config) {
          const fromBody = "body" in config;
          const schema = fromBody ? config.body : config.query;
          const source: unknown = fromBody ? req.body : req.query;
          const parsedInput = schema.safeParse(source);
          if (!parsedInput.success)
            return res.status(400).json({
              message: config.invalidInputMessage ?? parsedInput.error.message,
            });
          result = await config.run({
            params,
            input: parsedInput.data as z.output<I>,
            userId,
          });
        } else {
          result = await config.run({ params, userId });
        }

        const status = config.status ?? 200;
        return status === 204
          ? res.status(204).send()
          : res.status(status).json(result);
      } catch (err) {
        return handleError(err, res, config.fallback);
      }
    };
  }

  return { handleError, handler };
};
