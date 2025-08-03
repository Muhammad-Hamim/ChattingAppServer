import mongoose from "mongoose";
import { io, server } from "./app";
import config from "./app/config";
import { socketAuth } from "./app/middlewares/socketAuth";
import { AuthenticatedSocket } from "./types/TSocket";

async function main() {
  try {
    await mongoose.connect(config.database_url as string);
    server.listen(config.port, () => {
      console.log(`app is listening on port ${config.port}`);
    });

    // Add authentication middleware
    io.use(socketAuth);

    io.on("connection", (socket) => {
      const authSocket = socket as AuthenticatedSocket;
      console.log(
        `✅ New client connected: ${authSocket.name} (${authSocket.email}) - Socket ID: ${authSocket.socketId}`
      );
      // Send welcome message
      socket.emit("welcome", {
        message: "Connected successfully!",
        socketId: socket.id,
      });

      socket.on("disconnect", (reason) => {
        console.log(
          `❌ Client disconnected: ${authSocket.name} (${authSocket.email}) - Reason: ${reason}`
        );
      });
    });
  } catch (err) {
    console.log(err);
  }
}

main();

process.on("unhandledRejection", () => {
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  }
  process.exit(1);
});

process.on("uncaughtException", () => {
  process.exit(1);
});
