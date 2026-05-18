import express from "express";
import { analyticsControllers } from "./analytics.controller";
import auth from "../../middlewares/auth";

const router = express.Router();

router.get(
  "/provider",
  auth("provider"),
  analyticsControllers.getProviderAnalytics,
);

router.get("/admin", auth("admin"), analyticsControllers.getAdminAnalytics);

export const analyticsRoutes = router;
