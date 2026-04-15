import express from "express";
import { providerControllers } from "./provider.controller";

const router = express.Router();

router.get("/search", providerControllers.searchNearbyProviders);
router.get("/:providerId", providerControllers.getProviderById);

export const providerRoutes = router;
