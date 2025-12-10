import express from "express";
import rateLimit from "express-rate-limit";
import fileUpload from "express-fileupload";
import { registerRoutes } from "./routers";
import { StripeController } from "./controllers/web/stripe.controller";

export function createApp() {
  const app = express();

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.set("trust proxy", 1);
  app.use(limiter);
  app.use(fileUpload());
  app.use(express.json());

  app.post(
    "/v1/stripe/webhook",
    express.raw({ type: "application/json" }),
    StripeController.webhook
  );

  registerRoutes(app); // all routes in 1 place

  app.get("/health", (_, res) => res.status(200).json({ status: "ok" }));

  return app;
}
