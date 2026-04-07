import express from "express";
import auth from "../../../middlewares/auth";
import { aboutControllers } from "./About.controller";

const router = express.Router();

router.post("/create", auth("admin"), aboutControllers.createAbout);
router.get("/", aboutControllers.getAllAbout);
router.patch("/update", auth("admin"), aboutControllers.updateAbout);

export const AboutRoutes = router;
