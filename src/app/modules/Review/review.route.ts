// backend/src/modules/Review/review.routes.ts

import express from "express";
import { reviewControllers } from "./review.controller";
import auth from "../../middlewares/auth";

const router = express.Router();

// ─── Public ───────────────────────────────────────────────────────────────────
router.get("/my-reviews", auth("customer"), reviewControllers.getMyReviews);
router.get("/provider/:providerId", reviewControllers.getProviderReviews);

// ─── Customer ─────────────────────────────────────────────────────────────────
router.post("/create", auth("customer"), reviewControllers.createReview);

// ─── Provider ─────────────────────────────────────────────────────────────────
router.patch(
  "/:reviewId/reply",
  auth("provider"),
  reviewControllers.replyToReview,
);

// ─── Admin ────────────────────────────────────────────────────────────────────
router.delete("/:reviewId", auth("admin"), reviewControllers.deleteReview);

export const reviewRoutes = router;
