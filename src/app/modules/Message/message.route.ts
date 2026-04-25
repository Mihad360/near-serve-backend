// backend/src/modules/Message/message.routes.ts

import express, { NextFunction, Request, Response } from "express";
import { messageControllers } from "./message.controller";
import auth from "../../middlewares/auth";
import { upload } from "../../utils/sendImageToCloudinary";

const router = express.Router();

// ─── Get all messages in a conversation ──────────────────────────────────────
router.get(
  "/:conversationId",
  auth("customer", "provider"),
  messageControllers.getMessages,
);

// ─── Send text message ────────────────────────────────────────────────────────
router.post(
  "/:conversationId/send-text",
  auth("customer", "provider"),
  messageControllers.sendMessage,
);

// ─── Send attachment ──────────────────────────────────────────────────────────
router.post(
  "/:conversationId/attachment",
  auth("customer", "provider"),
  upload.array("files", 10), // limit e.g. max 10 files
  (req: Request, res: Response, next: NextFunction) => {
    if (req.body.data) {
      req.body = JSON.parse(req.body.data);
    }
    next();
  },
  messageControllers.sendAttachment,
);

// ─── Delete message ───────────────────────────────────────────────────────────
router.delete(
  "/:messageId",
  auth("customer", "provider"),
  messageControllers.deleteMessage,
);

export const messageRoutes = router;
