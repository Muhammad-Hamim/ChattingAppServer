import { Schema, model } from "mongoose";
import { TUser } from "./user.interface";

const userSchema = new Schema<TUser>(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true, // Index for efficient user queries
    },
    uid: {
      type: String,
      required: true,
      unique: true, // Ensure uid is unique
      index: true, // Index for efficient user queries
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);



export const User = model<TUser>("User", userSchema);
