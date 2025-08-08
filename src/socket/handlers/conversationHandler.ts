/**
 * The function `handleConversationEvents` manages socket events related to conversations, including
 * joining and leaving conversation rooms, sending typing indicators, and auto-joining users to their
 * conversation rooms upon connection.
 * @param {AuthenticatedSocket} socket - The `socket` parameter is an instance of an authenticated
 * socket, which allows communication between the server and the client using Socket.IO. It contains
 * information about the connected user, such as their ID and name.
 * @param _io - The `_io` parameter is an instance of `SocketIOServer` with specific event types
 * `ClientToServerEvents` and `ServerToClientEvents`. This instance is used to handle communication
 * between the server and clients using Socket.IO.
 */
import { Server as SocketIOServer } from "socket.io";
import { ConversationService } from "../../app/Models/conversation/conversation.service";
import Conversation from "../../app/Models/conversation/conversation.model";
import { AuthenticatedSocket } from "../../types/TSocket";
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../types/socketEvents";
import { User } from "../../app/Models/user/user.model"; // ✅ Fixed: Use forward slashes

export const handleConversationEvents = (
  socket: AuthenticatedSocket,
  _io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>
): void => {
  const user_id = socket._id.toString();

  // Join conversation room
  socket.on("join-conversation", async ({ conversationId }) => {
    // eslint-disable-next-line no-console
    console.log(
      `🔵 [${socket.name}] Attempting to join conversation: ${conversationId}`
    );

    try {
      // Get conversation directly from model to get Mongoose document with methods
      const conversation = await Conversation.findById(conversationId);
      console.log("join conversation", conversation);
      if (!conversation) {
        // eslint-disable-next-line no-console
        console.log(
          `❌ [${socket.name}] Conversation ${conversationId} not found`
        );
        return;
      }

      if (conversation.conversation_status !== "accepted") {
        // eslint-disable-next-line no-console
        console.log(
          `❌ [${socket.name}] Conversation ${conversationId} not accepted`
        );
        return;
      }
      // Check if user is a participant
      if (!conversation.isParticipant(socket._id.toString())) return;

      const roomName = `conversation-${conversationId}`;
      socket.join(roomName);

      // eslint-disable-next-line no-console
      console.log(
        `✅ [${socket.name}] Successfully joined conversation room: ${roomName}`
      );

      const users = await User.find({
        _id: { $in: conversation.participants.map((p) => p.user_id) },
      }).lean();

      // eslint-disable-next-line no-console
      console.log(
        `📤 [${socket.name}] Sending status for ${users.length} participants`
      );

      users.forEach((user) => {
        socket.emit("user-status-changed", {
          uid: user.uid,
          userId: user._id.toString(),
          name: user.name,
          email: user.email,
          status: user.status || "offline",
          lastSeen: user.lastSeen || new Date(),
          conversationId,
        });
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`❌ [${socket.name}] Error joining conversation:`, error);
    }
  });

  // Leave conversation room
  socket.on("leave-conversation", (data) => {
    socket.leave(`conversation-${data.conversationId}`);
    // eslint-disable-next-line no-console
    console.log(
      `🚪 [${socket.name}] Left conversation room: ${data.conversationId}`
    );
  });

  // Typing indicators
  socket.on("typing-start", (data) => {
    // eslint-disable-next-line no-console
    console.log(
      `⌨️ [${socket.name}] Started typing in conversation: ${data.conversationId}`
    );
    socket.to(`conversation-${data.conversationId}`).emit("typing-start", {
      conversationId: data.conversationId,
      uid: socket.uid,
    });
  });

  socket.on("typing-stop", (data) => {
    // eslint-disable-next-line no-console
    console.log(
      `⌨️ [${socket.name}] Stopped typing in conversation: ${data.conversationId}`
    );
    socket.to(`conversation-${data.conversationId}`).emit("typing-stop", {
      conversationId: data.conversationId,
      uid: socket.uid,
    });
  });

  // Auto-join user to their conversation rooms
  const autoJoinConversationRooms = async (): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log(`🔄 [${socket.name}] Auto-joining conversation rooms...`);

    try {
      const conversations = await ConversationService.getAllConversationService(
        {
          user_id,
          query: {},
        }
      );

      // eslint-disable-next-line no-console
      console.log(
        `🏠 [${socket.name}] Found ${conversations.length} conversations to join`
      );

      conversations.forEach((conversation: Record<string, unknown>) => {
        const roomName = `conversation-${conversation._id}`;
        socket.join(roomName);
        // eslint-disable-next-line no-console
        console.log(`✅ [${socket.name}] Auto-joined room: ${roomName}`);
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        `❌ [${socket.name}] Failed to auto-join conversation rooms:`,
        error
      );
    }
  };

  // Auto-join on connection
  autoJoinConversationRooms();
};
