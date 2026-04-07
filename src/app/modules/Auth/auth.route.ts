import express from "express";
import { authControllers } from "./auth.controller";
import auth from "../../middlewares/auth";

const router = express.Router();

router.post("/resend-otp/:email", authControllers.resendOtp);
router.post("/login", authControllers.loginUser);
router.post("/forget-password", authControllers.forgetPassword);
router.post(
  "/reset-password",
  auth("admin", "customer"),
  authControllers.resetPassword,
);
router.post("/verify-otp", authControllers.verifyOtp);
router.post(
  "/change-password",
  auth("admin", "customer"),
  authControllers.changePassword,
);
router.post("/refresh-token", authControllers.refreshToken);

export const AuthRoutes = router;
