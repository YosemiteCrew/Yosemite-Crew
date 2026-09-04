import express from "express";
import rateLimit from "express-rate-limit";
import fileUpload from "express-fileupload";
import { getControlReports, hasFailedControl } from "./config/startup-controls";
import { registerRoutes } from "./routers";
import { StripeController } from "./controllers/web/stripe.controller";
import { FinanceController } from "./controllers/app/finance.controller";
import cors from "cors";
import { DocumensoWebhookController } from "./controllers/web/documenso.controller";
import { OpenStatusWebhookController } from "./controllers/web/openstatus.controller";
import { ChatWebhookController } from "./controllers/app/chatWebhook.controller";
import { DeveloperBillingController } from "./controllers/web/developer-billing.controller";
import mongoSanitize from "express-mongo-sanitize";
import helmet from "helmet";
import wellKnownRouter from "./routers/well-known.router";
import {
  AuthService,
  createAuthProvider,
  initSuperTokens,
  readAuthConfig,
  registerSuperTokensBeforeRoutes,
  registerSuperTokensErrorHandler,
  setAuthService,
  validateAuthConfig,
} from "@yosemite-crew/auth";
import { authHooks } from "./config/auth-hooks";

function isSuperTokensEnabled(): boolean {
  const disabled =
    process.env.SUPERTOKENS_DISABLED === "true" ||
    process.env.SUPERTOKENS_DISABLED === "1";

  if (disabled) return false;

  return Boolean(
    process.env.SUPERTOKENS_CONNECTION_URI &&
    process.env.AUTH_API_DOMAIN &&
    process.env.AUTH_WEBSITE_DOMAIN,
  );
}

export function createApp() {
  const app = express();

  const superTokensEnabled = isSuperTokensEnabled();
  if (superTokensEnabled) {
    // Fail fast at startup on invalid auth config (epic #1672 acceptance).
    const authConfig = readAuthConfig();
    validateAuthConfig(authConfig);

    initSuperTokens(authHooks);
    setAuthService(new AuthService(createAuthProvider(authConfig)));

    // The provider's own auth routes (sign-in/up, OTP, refresh) are mounted
    // before the global limiter, so give them a dedicated - stricter - one:
    // they are the brute-force / enumeration surface.
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use("/auth", authLimiter);

    registerSuperTokensBeforeRoutes(app);
  } else {
    setAuthService(null);
  }
  app.use(helmet());
  app.disable("x-powered-by");

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.set("trust proxy", 1);
  app.use(limiter);

  app.post(
    "/v1/stripe/webhook",
    express.raw({ type: "application/json" }),
    (req, res) => StripeController.webhook(req, res),
  );

  app.post(
    "/v1/stripe/connect/webhook",
    express.raw({ type: "application/json" }),
    (req, res) => StripeController.connectWebhook(req, res),
  );

  app.post(
    "/v1/documenso/webhook",
    express.raw({ type: "application/json" }),
    (req, res) => DocumensoWebhookController.handle(req, res),
  );

  app.post(
    "/v1/openstatus/webhook",
    express.raw({ type: "application/json" }),
    (req, res) => OpenStatusWebhookController.handle(req, res),
  );

  app.post(
    "/v1/finance/webhooks/:provider",
    express.raw({ type: "application/json" }),
    (req, res) => FinanceController.webhook(req, res),
  );

  app.post(
    "/v1/chat/webhooks/stream",
    express.raw({ type: "application/json" }),
    (req, res) => ChatWebhookController.handleStreamEvent(req, res),
  );

  /**
   * Registered here rather than on `developerBillingRouter` with the rest of its
   * routes, for the same reason as every webhook above: `express.json()` on line
   * ~161 runs before `registerRoutes`, and once it has parsed a request
   * body-parser marks it done - so an `express.raw()` inside a router that mounts
   * later is a no-op and the controller receives a parsed object instead of the
   * Buffer `stripe.webhooks.constructEvent` needs. Signature verification then
   * fails on every call, and `checkout.session.completed` never lands, so a
   * developer who has actually paid is never moved onto Pro.
   */
  app.post(
    "/v1/developers/billing/webhook",
    express.raw({ type: "application/json" }),
    (req, res) => DeveloperBillingController.webhook(req, res),
  );

  app.use(fileUpload());

  if (process.env.LOCAL_DEVELOPMENT) {
    const allowedorigins = new Set([
      "http://localhost:3000", // Next.js / React
      "http://127.0.0.1:3000",
    ]);

    app.use(
      cors({
        origin: (origin, callback) => {
          // allow REST tools like Postman / curl
          if (!origin) return callback(null, true);

          if (allowedorigins.has(origin)) {
            return callback(null, true);
          }

          callback(new Error("Not allowed by CORS"));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: [
          "Content-Type",
          "Authorization",
          "X-Requested-With",
          "x-org-id",
          "x-documenso-signature",
          // SuperTokens headers (required when using cookie-based sessions)
          "rid",
          "fdi-version",
          "anti-csrf",
          "st-auth-mode",
        ],
      }),
    );
  }

  // Parse the raw signed bytes for AP inbox POSTs so the HTTP signature is
  // verified against the exact payload, not a re-serialized object.
  app.use(
    ["/ap/organizations/:orgId/inbox", "/ap/shared-inbox"],
    express.raw({
      type: [
        "application/activity+json",
        "application/ld+json",
        "application/json",
      ],
    }),
  );

  app.use(express.json());
  app.use(mongoSanitize());

  // ActivityPub well-known discovery (must be at root domain, before API routes)
  // Deliberately ahead of the no-store middleware below: federation discovery
  // documents are public and meant to be cached.
  app.use("/.well-known", wellKnownRouter);

  // Every API response is tenant-scoped and authenticated. The URLs are stable
  // (`/v1/finance/invoices?organisationId=...`), so without an explicit
  // directive a browser or intermediary cache is free to store one user's
  // invoices, records or audit trail and serve them to the next user of the
  // same browser after a logout/login.
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  registerRoutes(app); // all routes in 1 place

  app.get("/health", (_, res) => res.status(200).json({ status: "ok" }));

  // Startup controls, reported separately from liveness.
  //
  // /health answers 200 for a process that booted with a security control
  // silently absent - which is exactly what happened with the Stream upload
  // blocklist, on every environment, for as long as its format was wrong. This
  // route makes "failed to apply" visible from outside without anyone reading a
  // log, and returns 503 so a monitor can alarm on it.
  //
  // Deliberately unauthenticated and deliberately thin: control NAMES and
  // states only, never configuration values, so it is safe for an external
  // uptime check to poll.
  app.get("/health/controls", (_, res) => {
    const degraded = hasFailedControl();
    return res.status(degraded ? 503 : 200).json({
      status: degraded ? "degraded" : "ok",
      controls: getControlReports(),
    });
  });

  if (superTokensEnabled) {
    registerSuperTokensErrorHandler(app);
  }
  return app;
}
