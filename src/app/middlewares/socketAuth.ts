import { Socket } from "socket.io";
import admin from "firebase-admin";
import mongoose from "mongoose";
import { User } from "../Models";
import { UserService } from "../Models/user/user.service";
import { AuthenticatedSocket } from "../../types/TSocket";

export const socketAuth = async (
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> => {
  try {
    console.log("🔐 Socket authentication attempt:", socket.id);

    const { token } = socket.handshake.auth;

    // Quick validation first
    if (!token) {
      console.log("❌ Missing auth data");
      return next(new Error("Missing authentication data"));
    }

    // For real-time optimization, you can implement token caching here
    // to avoid Firebase verification on every connection

    // Verify Firebase token (this is the only "slow" part)
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Quick database lookup (consider Redis caching for high traffic)
    const user = await User.findOne({ uid: decodedToken.uid }).lean(); // .lean() for faster queries

    if (!user) {
      return next(new Error("User not found"));
    }
    // Cast and store user data in socket
    const authSocket = socket as AuthenticatedSocket;

    authSocket._id = new mongoose.Types.ObjectId(user._id);
    authSocket.uid = user.uid;
    authSocket.email = user.email;
    authSocket.name = user.name;
    authSocket.socketId = socket.id;

    // Update user status to online and lastLogin when socket connects
    await UserService.updateUserStatus(user._id.toString(), "online");

    console.log("✅ Socket authenticated:", authSocket.name);
    next();
  } catch (error: any) {
    console.error("❌ Socket auth failed:", error.message);
    next(new Error("Authentication failed"));
  }
};
