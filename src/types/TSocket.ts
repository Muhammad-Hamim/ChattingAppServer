import mongoose from "mongoose";
import { Socket } from "socket.io";

export interface AuthenticatedSocket extends Socket {
  _id: mongoose.Types.ObjectId;
  uid: string;
  email: string;
  name: string;
  socketId: string;
}
