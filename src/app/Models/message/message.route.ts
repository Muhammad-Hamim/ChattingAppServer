import { Router } from "express";
import { MessageController } from "./message.controller";
import { auth } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { MessageValidation } from "./message.validation";

const router = Router();

// Get messages for a specific conversation
router.get(
  "/:conversationId",
  auth(),
  MessageController.getConversationMessages
);

// Send a new message to a conversation
router.post(
  "/send/:conversationId",
  auth(),
  validateRequest(MessageValidation.sendMessageValidationSchema),
  MessageController.sendMessage
);

// // Edit a message
// router.patch(
//   "/:messageId/edit",
//   auth(),
//   validateRequest(MessageValidation.editMessageValidationSchema),
//   MessageController.editMessage
// );

// // Delete message for everyone (sender only, within 10 minutes)
// router.delete(
//   "/:messageId/delete-for-everyone",
//   auth(),
//   MessageController.deleteMessageForEveryone
// );

// // Delete message for me (any participant)
// router.delete(
//   "/:messageId/delete-for-me",
//   auth(),
//   MessageController.deleteMessageForMe
// );

export const MessageRoutes = router;
