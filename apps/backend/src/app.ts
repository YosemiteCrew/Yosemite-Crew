import express from "express";
import rateLimit from "express-rate-limit";
import fileUpload from "express-fileupload";
import { registerRoutes } from "./routers";
import { StripeController } from "./controllers/web/stripe.controller";
import { FinanceController } from "./controllers/app/finance.controller";
import cors from "cors";
import { DocumensoWebhookController } from "./controllers/web/documenso.controller";
import { ChatWebhookController } from "./controllers/app/chatWebhook.controller";
import mongoSanitize from "express-mongo-sanitize";
import {
  initSuperTokens,
  registerSuperTokensBeforeRoutes,
  registerSuperTokensErrorHandler,
} from "@yosemite-crew/auth";

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
    initSuperTokens();
    registerSuperTokensBeforeRoutes(app);
  }
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
    "/v1/finance/webhooks/:provider",
    express.raw({ type: "application/json" }),
    (req, res) => FinanceController.webhook(req, res),
  );

  app.post(
    "/v1/chat/webhooks/stream",
    express.raw({ type: "application/json" }),
    (req, res) => ChatWebhookController.handleStreamEvent(req, res),
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

  app.use(express.json());
  app.use(mongoSanitize());

  registerRoutes(app); // all routes in 1 place

  app.get("/health", (_, res) => res.status(200).json({ status: "ok" }));

  if (superTokensEnabled) {
    registerSuperTokensErrorHandler(app);
  }
  return app;
}
