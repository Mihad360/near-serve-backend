// backend/src/modules/Admin/admin.routes.ts

import express from "express";
import { adminControllers } from "./admin.controller";
import auth from "../../middlewares/auth";

const router = express.Router();

// all routes admin only
router.use(auth("admin"));

// ─── Providers ────────────────────────────────────────────────────────────────
router.get("/providers", adminControllers.getAllProviders);
router.get("/providers/:providerId", adminControllers.getProviderDetails);
router.patch(
  "/providers/:providerId/approve-reject",
  adminControllers.toggleProviderApproval,
);

// ─── Users ────────────────────────────────────────────────────────────────────
router.get("/users/:userId", adminControllers.getUserDetails);
router.patch(
  "/users/:userId/block-unblock",
  adminControllers.toggleUserBlockStatus,
);

// ─── Jobs ─────────────────────────────────────────────────────────────────────
router.get("/jobs", adminControllers.getAllJobs);
router.get("/jobs/:jobId", adminControllers.getJobDetails);
router.patch("/jobs/:jobId/cancel", adminControllers.adminCancelJob);

// ─── Disputes ─────────────────────────────────────────────────────────────────
router.get("/disputes", adminControllers.getAllDisputes);
router.get("/disputes/:jobId", adminControllers.getDisputeDetails);
router.patch("/disputes/:jobId/resolve", adminControllers.resolveDispute);

// ─── Reviews ──────────────────────────────────────────────────────────────────
router.get("/reviews", adminControllers.getAllReviews);
router.delete("/reviews/:reviewId", adminControllers.deleteReview);

export const adminRoutes = router;
