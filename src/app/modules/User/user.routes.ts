import express, { NextFunction, Request, Response } from "express";
import { userControllers } from "./user.controller";
import auth from "../../middlewares/auth";
import { upload } from "../../utils/sendImageToCloudinary";

const router = express.Router();

router.get("/", userControllers.getUsers);
router.get("/me", auth("admin", "customer"), userControllers.getMe);
router.patch(
  "/edit-profile",
  auth("admin", "customer", "provider"),
  upload.fields([
    { name: "image", maxCount: 1 }, // profile image
    { name: "portfolio", maxCount: 10 }, // multiple portfolio images
  ]),
  (req: Request, res: Response, next: NextFunction) => {
    if (req.body.data) {
      req.body = JSON.parse(req.body.data);
    }
    next();
  },
  userControllers.editProfile,
);

export const userRoutes = router;
