import { Server as SocketIOServer } from "socket.io";
import { Server } from "http";
import { socketAuth } from "../app/middlewares/socketAuth";
import {
  handleMessageEvents,
  handleUserEvents,
  handleConversationEvents,
} from "./handlers";
import { AuthenticatedSocket } from "../types/TSocket";
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from "./types/socketEvents";

export const initializeSocket = (
  server: Server
): SocketIOServer<ClientToServerEvents, ServerToClientEvents> => {
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(
    server,
    {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    }
  );

  // Add authentication middleware
  io.use(socketAuth);

  io.on("connection", async (socket) => {
    const authSocket = socket as AuthenticatedSocket;
    // eslint-disable-next-line no-console
    console.log(
      `✅ New client connected: ${authSocket.name} (${authSocket.email}) - Socket ID: ${authSocket.socketId}`
    );

    // Initialize all event handlers
    const userHandlers = handleUserEvents(authSocket, io);
    handleMessageEvents(authSocket, io);
    handleConversationEvents(authSocket, io);

    // Handle disconnection
    socket.on("disconnect", async (reason) => {
      // eslint-disable-next-line no-console
      console.log(
        `❌ Client disconnected: ${authSocket.name} (${authSocket.email}) - Reason: ${reason}`
      );

      // Handle user disconnection
      await userHandlers.handleUserDisconnect(reason);
    });
  });

  return io;
};
