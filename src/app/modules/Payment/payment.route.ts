// backend/src/modules/Payment/payment.routes.ts

import express from "express";
import { paymentControllers } from "./payment.controller";
import auth from "../../middlewares/auth";

const router = express.Router();

// ─── Customer ─────────────────────────────────────────────────────────────────
router.post(
  "/create-intent",
  auth("customer"),
  paymentControllers.createPaymentIntent,
);

router.post("/capture", auth("customer"), paymentControllers.capturePayment);

// ─── Customer and Provider ────────────────────────────────────────────────────
router.get(
  "/history",
  auth("customer", "provider"),
  paymentControllers.getPaymentHistory,
);

// ─── Admin ────────────────────────────────────────────────────────────────────
// ─── Admin ────────────────────────────────────────────────────────────────────
router.post("/cancel", auth("admin"), paymentControllers.cancelPayment);

router.post("/refund", auth("admin"), paymentControllers.refundPayment);

export const paymentRoutes = router;
