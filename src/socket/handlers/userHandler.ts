import { Server as SocketIOServer } from "socket.io";
import { UserService } from "../../app/Models/user/user.service";
import { AuthenticatedSocket } from "../../types/TSocket";
import {
  broadcastUserStatusToContacts,
  markPendingMessagesAsDelivered,
} from "../utils/socketHelpers";
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../types/socketEvents";

export const handleUserEvents = (
  socket: AuthenticatedSocket,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>
): { handleUserDisconnect: (reason: string) => Promise<void> } => {
  const user_id = socket._id.toString();

  // Handle manual status updates (away, busy, etc.)
  socket.on("update-status", async (data) => {
    try {
      await UserService.updateUserStatus(user_id, data.status);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error updating user status:", error);
    }
  });

  // Handle user connection
  const handleUserConnect = async (): Promise<void> => {
    try {
      socket.join(`user-${socket.uid}`);
      // Update user status to online
      await UserService.updateUserStatus(user_id, "online");

      await broadcastUserStatusToContacts(io, user_id, "online");

      // ✅ Mark pending messages as delivered when user connects
      await markPendingMessagesAsDelivered(io, user_id);

      // Send welcome message
      socket.emit("welcome", {
        message: "Connected successfully!",
        socketId: socket.id,
        name: socket.name,
        uid: socket.uid,
        status: "online",
      });

      // eslint-disable-next-line no-console
      console.log(`✅ User ${socket.name} is now online`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        `Failed to handle user connection for ${socket.name}:`,
        error
      );
    }
  };

  // Handle user disconnection
  const handleUserDisconnect = async (reason: string): Promise<void> => {
    try {
      // Update user status to offline
      await UserService.updateUserStatus(user_id, "offline");

      //Broadcast offline status to all contacts
      await broadcastUserStatusToContacts(io, user_id, "offline");

      // eslint-disable-next-line no-console
      console.log(`❌ User ${socket.name} went offline - Reason: ${reason}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        `Failed to handle user disconnection for ${socket.name}:`,
        error
      );
    }
  };

  // Call connect handler immediately
  handleUserConnect();

  // Return disconnect handler for use in main socket handler
  return {
    handleUserDisconnect,
  };
};
