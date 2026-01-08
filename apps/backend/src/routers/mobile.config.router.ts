import { Router } from "express";

interface MobileConfig {
  env: "dev" | "staging" | "prod";
  apiBaseUrl: string;
  enablePayments: boolean;
  stripePublishableKey?: string;
  sentryDsn?: string;
}

const resolveMobileConfig = (): MobileConfig => {
  return {
    env: process.env.NODE_ENV as "dev" | "staging" | "prod",

    apiBaseUrl: process.env.MOBILE_API_BASE_URL!,
    enablePayments: process.env.ENABLE_PAYMENTS === "true",

    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  };
};

const router = Router();

router.get("", (_req, res) => {
  const config = resolveMobileConfig();
  res.status(200).json(config);
});

export default router;
