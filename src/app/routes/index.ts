import { Router } from "express";
import { AuthRouter } from "../auth/auth.route";
import { UserRouter } from "../Models/user/user.route";
import { ConversationRouter } from "../Models/conversation/conversation.route";
import { MessageRoutes } from "../Models/message/message.route";

const router = Router();

const moduleRoutes = [
  {
    path: "/auth",
    route: AuthRouter,
  },
  {
    path: "/user",
    route: UserRouter,
  },
  {
    path: "/conversation",
    route: ConversationRouter,
  },
  {
    path: "/message",
    route: MessageRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
