import { Server as SocketIOServer } from "socket.io";
import { MessageService } from "../../app/Models/message/message.service";
import { AuthenticatedSocket } from "../../types/TSocket";
import { SocketResponse } from "../utils/socketHelpers";
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../types/socketEvents";

export const handleMessageEvents = (
  socket: AuthenticatedSocket,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>
): void => {
  const userId = socket._id.toString();

  // Send message
  socket.on("send-message", async (data, callback) => {
    try {
      const message = await MessageService.sendMessageService({
        conversationId: data.conversationId,
        senderId: userId,
        content: data.content,
        type: data?.type as never,
        caption: data?.caption,
        replyTo: data?.replyTo,
        metadata: data?.metadata as never,
      });

      // Emit to conversation room (excluding sender)
      socket.to(`conversation-${data.conversationId}`).emit("new-message", {
        message: message as Record<string, unknown>,
      });

      // Send success response to sender
      SocketResponse.success(callback, { message });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error sending message:", error);
      SocketResponse.error(callback, error);
    }
  });

  // Edit message
  socket.on("edit-message", async (data, callback) => {
    try {
      const message = await MessageService.editMessageService({
        messageId: data.messageId,
        userId,
        newContent: data.newContent,
      });

      const messageObj = message as Record<string, unknown>;
      const conversationId = messageObj.conversation_id;

      // Emit to conversation room
      io.to(`conversation-${conversationId}`).emit("message-edited", {
        messageId: data.messageId,
        newContent: data.newContent,
        editedAt: new Date(),
        conversationId: conversationId as string,
      });

      SocketResponse.success(callback, { message });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error editing message:", error);
      SocketResponse.error(callback, error);
    }
  });

  // Delete message for everyone
  socket.on("delete-message-everyone", async (data, callback) => {
    try {
      const message = await MessageService.deleteMessageForEveryoneService({
        messageId: data.messageId,
        userId,
      });

      const messageObj = message as Record<string, unknown>;
      const conversationId = messageObj.conversation_id;

      // Emit to conversation room
      io.to(`conversation-${conversationId}`).emit("message-deleted-everyone", {
        messageId: data.messageId,
        conversationId: conversationId as string,
        deletedAt: new Date(),
      });

      SocketResponse.success(callback, {
        message: "Message deleted for everyone",
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error deleting message for everyone:", error);
      SocketResponse.error(callback, error);
    }
  });

  // Delete message for me
  socket.on("delete-message-me", async (data, callback) => {
    try {
      await MessageService.deleteMessageForMeService({
        messageId: data.messageId,
        userId,
      });

      SocketResponse.success(callback, { message: "Message deleted for you" });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error deleting message for user:", error);
      SocketResponse.error(callback, error);
    }
  });

  // Add reaction
  socket.on("add-reaction", async (data, callback) => {
    try {
      const message = await MessageService.addReactionService({
        messageId: data.messageId,
        userId,
        emoji: data.emoji,
      });

      const messageObj = message as Record<string, unknown>;
      const conversationId = messageObj.conversation_id;

      // Emit to conversation room
      io.to(`conversation-${conversationId}`).emit("reaction-added", {
        messageId: data.messageId,
        userId,
        emoji: data.emoji,
        conversationId: conversationId as string,
        reactedAt: new Date(),
      });

      SocketResponse.success(callback, { message: "Reaction added" });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error adding reaction:", error);
      SocketResponse.error(callback, error);
    }
  });

  // Remove reaction
  socket.on("remove-reaction", async (data, callback) => {
    try {
      const message = await MessageService.removeReactionService({
        messageId: data.messageId,
        userId,
        emoji: data.emoji,
      });

      const messageObj = message as Record<string, unknown>;
      const conversationId = messageObj.conversation_id;

      // Emit to conversation room
      io.to(`conversation-${conversationId}`).emit("reaction-removed", {
        messageId: data.messageId,
        userId,
        emoji: data.emoji,
        conversationId: conversationId as string,
      });

      SocketResponse.success(callback, { message: "Reaction removed" });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error removing reaction:", error);
      SocketResponse.error(callback, error);
    }
  });
};
