import mongoose from "mongoose";
import { server } from "./app";
import config from "./app/config";
import { initializeSocket } from "./socket";

async function main(): Promise<void> {
  try {
    await mongoose.connect(config.database_url as string);

    // Initialize Socket.IO with modular handlers
    initializeSocket(server);

    server.listen(config.port, () => {
      // eslint-disable-next-line no-console
      console.log(`app is listening on port ${config.port}`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
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
