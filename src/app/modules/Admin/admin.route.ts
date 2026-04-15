import express from "express";
import auth from "../../middlewares/auth";
import { adminControllers } from "./admin.controller";

const router = express.Router();

router.get("/providers", auth("admin"), adminControllers.getAllProviders);
// ─── Admin only ───────────────────────────────────────────────────────────────

router.patch(
  "/provider/approve/:providerId",
  auth("admin"),
  adminControllers.approveProvider,
);

export const adminRoutes = router;
