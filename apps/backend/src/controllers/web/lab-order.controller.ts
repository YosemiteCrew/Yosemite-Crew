import { Request, Response } from "express";
import { z } from "zod";
import { OrgRequest } from "src/middlewares/rbac";
import { LabOrderService } from "src/services/lab-order.service";
import { respondLabOrderServiceError } from "src/controllers/web/shared/lab-order-error";

const ListOrdersSearchBodySchema = z.preprocess(
  (value) => {
    if (value === null || value === undefined) return {};
    return value;
  },
  z.object({
    appointmentId: z.string().min(1).optional(),
    patientId: z.string().min(1).optional(),
    status: z
      .enum([
        "CREATED",
        "SUBMITTED",
        "AT_THE_LAB",
        "PARTIAL",
        "RUNNING",
        "COMPLETE",
        "CANCELLED",
        "ERROR",
      ])
      .optional(),
    limit: z.preprocess((value) => {
      if (typeof value === "string" && value.trim() !== "")
        return Number(value);
      if (typeof value === "number") return value;
      return undefined;
    }, z.number().int().positive().max(200).optional()),
  }),
);

const requireOrgAndProvider = (req: Request, res: Response) => {
  const orgReq = req as OrgRequest;
  const organisationId = orgReq.organisationId ?? req.params.organisationId;
  const provider = req.params.provider;

  if (!organisationId) {
    res.status(400).json({ message: "organisationId is required." });
    return null;
  }
  if (!provider) {
    res.status(400).json({ message: "provider is required." });
    return null;
  }

  return { organisationId, provider, orgReq };
};

const requireOrderParams = (req: Request, res: Response) => {
  const base = requireOrgAndProvider(req, res);
  if (!base) return null;

  const idexxOrderId = req.params.idexxOrderId;
  if (!idexxOrderId) {
    res.status(400).json({ message: "idexxOrderId is required." });
    return null;
  }

  return { ...base, idexxOrderId };
};

export const LabOrderController = {
  async listOrders(req: Request, res: Response) {
    try {
      const base = requireOrgAndProvider(req, res);
      if (!base) return;
      const { organisationId, provider } = base;

      const orders = await LabOrderService.listOrders({
        organisationId,
        provider,
      });

      return res.status(200).json({ orders });
    } catch (error) {
      return respondLabOrderServiceError(
        res,
        error,
        "Failed to list lab orders",
        "Failed to list lab orders.",
      );
    }
  },

  async searchOrders(req: Request, res: Response) {
    try {
      const base = requireOrgAndProvider(req, res);
      if (!base) return;
      const { organisationId, provider } = base;

      const bodyResult = ListOrdersSearchBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        return res.status(400).json({ message: "Invalid request body." });
      }

      const { appointmentId, patientId, status, limit } = bodyResult.data;

      const orders = await LabOrderService.listOrders({
        organisationId,
        appointmentId,
        patientId,
        provider,
        status,
        limit,
      });

      return res.status(200).json({ orders });
    } catch (error) {
      return respondLabOrderServiceError(
        res,
        error,
        "Failed to search lab orders",
        "Failed to search lab orders.",
      );
    }
  },

  async listProviderTests(req: Request, res: Response) {
    try {
      const base = requireOrgAndProvider(req, res);
      if (!base) return;
      const { provider } = base;

      /*
        This handler is registered for GET and POST on the same path. It read
        only `req.body`, so every GET - which is what the picker sends - arrived
        with query, limit and page undefined and fell through to an unfiltered
        alphabetical first page of 50. Typing "SDMA" returned nothing, because
        the client then filtered client-side over rows that never contained it.

        Query-string values are always strings, so a `typeof === "number"` test
        can never pass for a GET; the numbers are coerced rather than type-tested.
      */
      const body = req.body as
        | {
            query?: string;
            limit?: number;
            page?: number;
            codes?: string[];
          }
        | undefined;
      const search = req.query as {
        query?: unknown;
        limit?: unknown;
        page?: unknown;
        codes?: unknown;
      };

      /* The body keeps its strict typing - a POST sending `limit: "10"` is a
         malformed request and is dropped, which an existing test pins. Only the
         query string is coerced, because there every value is a string by
         definition. */
      const queryString = (value: unknown): string | undefined =>
        typeof value === "string" && value.trim() ? value : undefined;

      /**
       * Pagination has to be a positive integer, not merely a finite number.
       * `skip`/`take` reach Prisma, which rejects a fractional value, so
       * `?limit=2.5` turned into a 500 instead of falling back to the default -
       * the service's own `> 0` guard passes a fraction straight through.
       * Applied to the body too: `{ limit: 2.5 }` is a number and would have
       * taken the same path.
       */
      const paginationValue = (value: unknown): number | undefined => {
        const parsed =
          typeof value === "number"
            ? value
            : typeof value === "string" && value.trim()
              ? Number(value)
              : Number.NaN;
        return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
      };

      const query =
        typeof body?.query === "string"
          ? body.query
          : queryString(search.query);
      /* The body stays strict about type - a POST sending `limit: "10"` is
         malformed and is dropped, which an existing test pins - but both paths
         share the same integer requirement. */
      const limit = paginationValue(
        typeof body?.limit === "number" ? body.limit : search.limit,
      );
      const page = paginationValue(
        typeof body?.page === "number" ? body.page : search.page,
      );

      /* POST sends codes as an array; a GET sends a comma-separated string, and
         express hands back an array when the param is repeated. */
      const rawCodes = Array.isArray(body?.codes) ? body?.codes : search.codes;
      const codesParam = Array.isArray(rawCodes)
        ? rawCodes.join(",")
        : queryString(rawCodes);
      const codes = codesParam
        ? codesParam
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
        : undefined;

      const tests = await LabOrderService.listProviderTests(provider, {
        query,
        limit,
        page,
        codes,
      });

      return res.status(200).json(tests);
    } catch (error) {
      return respondLabOrderServiceError(
        res,
        error,
        "Failed to list lab tests",
        "Failed to list lab tests.",
      );
    }
  },

  async createIdexxOrder(req: Request, res: Response) {
    try {
      const base = requireOrgAndProvider(req, res);
      if (!base) return;
      const { organisationId, provider, orgReq } = base;
      const createdByUserId = orgReq.userId;

      const body = req.body as {
        patientId?: string;
        appointmentId?: string;
        tests?: string[];
        modality?: "IN_HOUSE" | "REFERENCE_LAB";
        ivls?: Array<{ serialNumber: string }>;
        veterinarian?: string;
        technician?: string;
        notes?: string;
        specimenCollectionDate?: string;
      };

      const created = await LabOrderService.createOrder(provider, {
        organisationId,
        patientId: body.patientId ?? "",
        appointmentId: body.appointmentId,
        createdByUserId: createdByUserId ?? undefined,
        tests: body.tests ?? [],
        modality: body.modality,
        ivls: body.ivls,
        veterinarian: body.veterinarian ?? null,
        technician: body.technician ?? null,
        notes: body.notes ?? null,
        specimenCollectionDate: body.specimenCollectionDate ?? null,
      });

      return res.status(201).json(created);
    } catch (error) {
      return respondLabOrderServiceError(
        res,
        error,
        "Failed to create IDEXX order",
        "Failed to create IDEXX order.",
      );
    }
  },

  async getOrder(req: Request, res: Response) {
    try {
      const params = requireOrderParams(req, res);
      if (!params) return;
      const { organisationId, provider, idexxOrderId } = params;

      const order = await LabOrderService.getOrder(
        provider,
        organisationId,
        idexxOrderId,
      );

      return res.status(200).json(order);
    } catch (error) {
      return respondLabOrderServiceError(
        res,
        error,
        "Failed to fetch lab order",
        "Failed to fetch lab order.",
      );
    }
  },

  async updateOrder(req: Request, res: Response) {
    try {
      const params = requireOrderParams(req, res);
      if (!params) return;
      const { organisationId, provider, idexxOrderId } = params;

      const body = req.body as {
        tests?: string[];
        modality?: "IN_HOUSE" | "REFERENCE_LAB";
        ivls?: Array<{ serialNumber: string }>;
        veterinarian?: string;
        technician?: string;
        notes?: string;
        specimenCollectionDate?: string;
      };

      const order = await LabOrderService.updateOrder(
        provider,
        organisationId,
        idexxOrderId,
        {
          tests: body.tests,
          modality: body.modality,
          ivls: body.ivls,
          veterinarian: body.veterinarian ?? null,
          technician: body.technician ?? null,
          notes: body.notes ?? null,
          specimenCollectionDate: body.specimenCollectionDate ?? null,
        },
      );

      return res.status(200).json(order);
    } catch (error) {
      return respondLabOrderServiceError(
        res,
        error,
        "Failed to update lab order",
        "Failed to update lab order.",
      );
    }
  },

  async cancelOrder(req: Request, res: Response) {
    try {
      const params = requireOrderParams(req, res);
      if (!params) return;
      const { organisationId, provider, idexxOrderId } = params;

      const order = await LabOrderService.cancelOrder(
        provider,
        organisationId,
        idexxOrderId,
      );

      return res.status(200).json(order);
    } catch (error) {
      return respondLabOrderServiceError(
        res,
        error,
        "Failed to cancel lab order",
        "Failed to cancel lab order.",
      );
    }
  },
};
