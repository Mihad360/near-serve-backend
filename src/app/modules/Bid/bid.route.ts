// backend/src/modules/Bid/bid.routes.ts

import express from "express";
import { bidControllers } from "./bid.controller";
import auth from "../../middlewares/auth";

const router = express.Router();

// ─── Provider ─────────────────────────────────────────────────────────────────

router.get("/my-bids", auth("provider"), bidControllers.getMyBids);

// ─── Customer ─────────────────────────────────────────────────────────────────
router.get("/:jobId", auth("customer"), bidControllers.getBidsForJob);

router.post("/:jobId/submit", auth("provider"), bidControllers.submitBid);
router.patch("/:bidId/accept", auth("customer"), bidControllers.acceptBid);
router.patch("/:bidId/withdraw", auth("provider"), bidControllers.withdrawBid);

router.patch("/:bidId/read", auth("customer"), bidControllers.markBidAsRead);

export const bidRoutes = router;
