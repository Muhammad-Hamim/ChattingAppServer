import { Server as SocketIOServer } from "socket.io";
import { ConversationService } from "../../app/Models/conversation/conversation.service";
import { UserService } from "../../app/Models/user/user.service";
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../types/socketEvents";
import { Conversation, User } from "../../app/Models";
import AppError from "../../app/errors/AppError";
import  httpStatus  from "http-status";

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
