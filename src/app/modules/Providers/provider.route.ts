import express from "express";
import { providerControllers } from "./provider.controller";
import auth from "../../middlewares/auth";

const router = express.Router();

// ─── Public ───────────────────────────────────────────────────────────────────
router.get("/search", providerControllers.searchNearbyProviders);
router.get("/:id", providerControllers.getProviderById);

// ─── Provider only ────────────────────────────────────────────────────────────
router.post("/setup", auth("provider"), providerControllers.setupProfile);

// ─── Admin only ───────────────────────────────────────────────────────────────
router.get("/", auth("admin"), providerControllers.getAllProviders);

router.patch(
  "/approve/:id",
  auth("admin"),
  providerControllers.approveProvider,
);

export const providerRoutes = router;
