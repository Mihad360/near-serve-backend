import { Router } from "express";
import { userRoutes } from "../modules/User/user.routes";
import { AuthRoutes } from "../modules/Auth/auth.route";
import { providerRoutes } from "../modules/Providers/provider.route";
import { adminRoutes } from "../modules/Admin/admin.route";
import { jobRoutes } from "../modules/Jobs/job.route";
import { bidRoutes } from "../modules/Bid/bid.route";
import { conversationRoutes } from "../modules/Conversation/conversation.route";
import { messageRoutes } from "../modules/Message/message.route";
import { reviewRoutes } from "../modules/Review/review.route";

const router = Router();

const moduleRoutes = [
  {
    path: "/users",
    route: userRoutes,
  },
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/provider",
    route: providerRoutes,
  },
  {
    path: "/admin",
    route: adminRoutes,
  },
  {
    path: "/job",
    route: jobRoutes,
  },
  {
    path: "/bid",
    route: bidRoutes,
  },
  {
    path: "/conversation",
    route: conversationRoutes,
  },
  {
    path: "/message",
    route: messageRoutes,
  },
  {
    path: "/review",
    route: reviewRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route?.route));

export default router;
