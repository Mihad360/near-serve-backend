import express from "express";
import { conversationControllers } from "./conversation.controller";
import auth from "../../middlewares/auth";

const router = express.Router();

router.get(
  "/",
  auth("customer", "provider"),
  conversationControllers.getMyConversations,
);

router.get(
  "/:id",
  auth("customer", "provider"),
  conversationControllers.getConversationById,
);

router.delete(
  "/:id",
  auth("customer", "provider"),
  conversationControllers.deleteConversation,
);

export const conversationRoutes = router;
