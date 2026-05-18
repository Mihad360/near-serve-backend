import express from "express";
import { aiControllers } from "./ai.controller";
import auth from "../../middlewares/auth";

const router = express.Router();

// ─── Customer ─────────────────────────────────────────────────────────────────
router.get(
  "/recommendations",
  auth("customer"),
  aiControllers.getRecommendations,
);
// ─── Public ───────────────────────────────────────────────────────────────────
router.get("/trust-score/:providerId", aiControllers.getTrustScore);
router.post("/chat", aiControllers.aiChat);

// ─── Admin ────────────────────────────────────────────────────────────────────
router.post(
  "/recalculate-scores",
  auth("admin"),
  aiControllers.recalculateAllScores,
);

export const aiRoutes = router;
