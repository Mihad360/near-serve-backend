// notification.routes.ts

import express from "express";
import { notificationControllers } from "./notification.controller";
import auth from "../../middlewares/auth";

const router = express.Router();

router.get(
  "/",
  auth("customer", "provider", "admin"),
  notificationControllers.getMyNotifications,
);

router.patch(
  "/:id/read",
  auth("customer", "provider", "admin"),
  notificationControllers.markAsRead,
);

router.patch(
  "/read-all",
  auth("customer", "provider", "admin"),
  notificationControllers.markAllAsRead,
);

router.get(
  "/unread-count",
  auth("customer", "provider", "admin"),
  notificationControllers.getUnreadCount,
);

export const notificationRoutes = router;
