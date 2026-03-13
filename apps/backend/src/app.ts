import express from "express";
import rateLimit from "express-rate-limit";
import fileUpload from "express-fileupload";
import { registerRoutes } from "./routers";
import { StripeController } from "./controllers/web/stripe.controller";
import cors from "cors";
import { DocumensoWebhookController } from "./controllers/web/documenso.controller";
import mongoSanitize from "express-mongo-sanitize";

export function createApp() {
  const app = express();
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
    "/v1/documenso/webhook",
    express.raw({ type: "application/json" }),
    (req, res) => DocumensoWebhookController.handle(req, res),
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
        allowedHeaders: ["Content-Type", "Authorization"],
      }),
    );
  }

  app.use(express.json());
  app.use(mongoSanitize());

  registerRoutes(app); // all routes in 1 place

  app.get("/health", (_, res) => res.status(200).json({ status: "ok" }));

  return app;
}
