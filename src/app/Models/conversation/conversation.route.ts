import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { ConversationValidation } from "./conversation.validation";
import { conversationController } from "./conversation.controller";
import { auth } from "../../middlewares/auth";

const router = express.Router();

router.post(
  "/create",
  auth(),
  validateRequest(ConversationValidation.createDMCRvalidation),
  conversationController.createDMConversation
);

router.patch(
  "/respond/:conversationId",
  auth(),
  validateRequest(ConversationValidation.respondToConversationRequestSchema),
  conversationController.respondToConversationRequest
);

router.get("/all", auth(), conversationController.getAllConversations);
router.get(
  "/:conversationId",
  auth(),
  conversationController.getConversationById
);

export const ConversationRouter = router;
