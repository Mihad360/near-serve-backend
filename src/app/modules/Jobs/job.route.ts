import express from "express";
import { jobControllers } from "./job.controller";
import auth from "../../middlewares/auth";

const router = express.Router();

// ─── Customer ─────────────────────────────────────────────────────────────────
router.get("/", auth("admin"), jobControllers.getAllJobs);
router.get("/my-jobs", auth("customer"), jobControllers.getMyJobs);
router.get("/feed", auth("provider"), jobControllers.getJobFeed);
router.get("/:jobId", auth("customer", "provider"), jobControllers.getJobById);

router.post("/create", auth("customer"), jobControllers.createJob);

router.delete("/:jobId", auth("customer"), jobControllers.cancelJob);

// ─── Provider ─────────────────────────────────────────────────────────────────

// ─── Shared — customer and provider ──────────────────────────────────────────

router.patch(
  "/:jobId/status",
  auth("customer", "provider"),
  jobControllers.updateJobStatus,
);

// ─── Admin ────────────────────────────────────────────────────────────────────

export const jobRoutes = router;
