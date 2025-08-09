import { Server as SocketIOServer } from "socket.io";
import { ConversationService } from "../../app/Models/conversation/conversation.service";
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../types/socketEvents";
import { Message, User } from "../../app/Models";
import { TMessage } from "../../app/Models/message/message.interface";
import AppError from "../../app/errors/AppError";
import httpStatus from "http-status";

// Socket response helper
export class SocketResponse {
  static success(
    callback?: (response: {
      success: boolean;
      message?: string;
      error?: string;
    }) => void,
    data?: Record<string, unknown>
  ): void {
    if (callback) {
      callback({
        success: true,
        ...data,
      });
    }
  }

  static error(
    callback:
      | ((response: {
          success: boolean;
          message?: string;
          error?: string;
        }) => void)
      | undefined,
    error: unknown
  ): void {
    if (callback) {
      callback({
        success: false,
        error: error instanceof Error ? error.message : "An error occurred",
      });
    }
  }
}

export const broadcastUserStatusToContacts = async (
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  user_id: string,
  status: "online" | "offline"
): Promise<void> => {
  const conversations = await ConversationService.getAllConversationService({
    user_id,
    query: {},
  });
  const user = await User.findById(user_id);
  if (!user) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "user not found broadcast user status to contacts"
    );
  }

  const participants = conversations.map((conversation: any) => ({
    uid: conversation.participants.uid,
    conversationId: conversation._id,
  }));
  participants.forEach(
    (participant: { uid: string; conversationId: string }) => {
      const roomName = `user-${participant.uid}`;
      io.to(roomName).emit("user-status-changed", {
        _id: user._id.toString(),
        uid: user.uid,
        email: user.email,
        name: user.name,
        status: status,
        lastSeen: user.lastSeen as Date,
        conversationId: participant.conversationId,
      });
    }
  );
};

/**
 * Mark all pending messages as delivered when user comes online
 */

export const markPendingMessagesAsDelivered = async (
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  user_id: string
): Promise<void> => {
  //get all conversations for the user
  const conversations = await ConversationService.getAllConversationService({
    user_id,
    query: {},
  });
  if (!conversations || conversations.length === 0) {
    // No conversations found, nothing to do
    return;
  }
  //get all conversation ids
  const conversationIds = conversations.map((conversation: { _id: string }) =>
    conversation._id.toString()
  );

  // Step 2: Find messages in those conversations where:
  // - User is NOT the sender
  // - Message status is "sent" or user hasn't marked it as delivered/seen yet
  const pendingMessages = (await Message.find({
    conversation_id: { $in: conversationIds },
    sender: { $ne: user_id },
    status: "sent",
  }).populate("sender", "uid")) as (TMessage & { sender: { uid: string } })[];

  if (!pendingMessages || pendingMessages.length === 0) {
    // No pending messages found, nothing to do
    return;
  }
  //pending messageIds
  const messageIds = pendingMessages.map((message) =>
    (message._id as { toString(): string }).toString()
  );
  //update message status to delivered
  await Message.updateMany(
    { _id: { $in: messageIds } },
    { $set: { status: "delivered" } }
  );
  // Notify sender that their messages have been delivered
  pendingMessages.forEach((message) => {
    io.to(`user-${message.sender.uid}`).emit("mark-message-delivered", {
      messageId: (message._id as { toString(): string }).toString(),
    });
  });
};




// Error handler for socket events
export const handleSocketError = (
  error: unknown,
  eventName: string,
  socketId: string
): void => {
  // eslint-disable-next-line no-console
  console.error(`Socket error in ${eventName} for socket ${socketId}:`, error);

  // You can add error tracking/monitoring here
  // e.g., send to error tracking service
};
