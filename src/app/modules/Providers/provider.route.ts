import express from "express";
import { providerControllers } from "./provider.controller";
import auth from "../../middlewares/auth";

const router = express.Router();

router.get("/search", providerControllers.searchNearbyProviders);
router.get("/:providerId", providerControllers.getProviderById);

// ─── Provider Stripe Connect ──────────────────────────────────────────────────
router.get(
  "/stripe/onboarding-link",
  auth("provider"),
  providerControllers.getStripeOnboardingLink,
);

router.get(
  "/stripe/account-status",
  auth("provider"),
  providerControllers.checkStripeAccountStatus,
);
router.get(
  "/stripe/dashboard-link",
  auth("provider"),
  providerControllers.getStripeDashboardLink,
);
router.post(
  "/stripe/create-account",
  auth("provider"),
  providerControllers.createStripeAccount,
);

export const providerRoutes = router;
