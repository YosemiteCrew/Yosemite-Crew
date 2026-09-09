import { Request, Response } from "express";
import { z } from "zod";
import { SuperadminConsentService } from "src/services/superadmin-consent.service";
import { resolveVerifiedUserId } from "src/utils/request";
import type { AuthenticatedRequest } from "src/middlewares/auth";

const consentWebBodySchema = z.object({
  consentId: z.string().min(1).max(200),
  granted: z.boolean(),
});

/**
 * Public relay for the web cookie banner's consent decision. The banner fires
 * on marketing and product pages alike, often before sign-in, so the route is
 * anonymous; the shared consent key lives only server-side in the forward.
 *
 * The product app keeps no consent ledger of its own - the SuperAdmin panel's
 * append-only ledger IS the durable record, so a rejected decision here must
 * still have been recorded there. The panel being down or unconfigured must
 * never fail the visitor, so the forward runs off the request path and the
 * response is a 202 regardless: the confirmation the visitor earns is the
 * banner dismissing, not our HTTP status.
 *
 * Identity is best-effort enrichment, never required: `attachSessionIfPresent`
 * supplies the verified userId/email when a session happens to be present, and
 * the panel links them fill-only-if-absent. A signed-out visitor's decision is
 * recorded against the consentId the browser generated - anonymous but durable.
 */
export const ConsentController = {
  reportWebDecision(this: void, req: Request, res: Response): void {
    const parsed = consentWebBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "A consentId and a boolean decision are required",
      });
      return;
    }

    const uid = resolveVerifiedUserId(req);
    const email = (req as AuthenticatedRequest).email;

    const payload = {
      consentId: parsed.data.consentId,
      source: "web" as const,
      decisions: [
        { category: "analytics" as const, granted: parsed.data.granted },
      ],
      userId: uid,
      email,
    };

    const userAgent =
      typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"]
        : undefined;

    // Fire-and-forget: a missing or failing forward must never surface to the
    // visitor; the banner dismissal already happened.
    void SuperadminConsentService.forwardConsentDecision(payload, userAgent);

    res.status(202).json({ ok: true });
  },
};
