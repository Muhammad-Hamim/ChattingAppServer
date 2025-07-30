import { Schema, model } from "mongoose";
import {
  ConversationModel,
  IConversation,
  TParticipants,
} from "./conversation.interface";

// Participant sub-schema
const participantSchema = new Schema<TParticipants>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["member", "admin", "initiator", "receiver"],
    },
  },
  { _id: false }
);

// Group details sub-schema
const groupDetailsSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    image: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

// Main conversation schema
const conversationSchema = new Schema<IConversation, ConversationModel>(
  {
    type: {
      type: String,
      enum: ["DM", "GROUP"],
      required: true,
    },
    participants: {
      type: [participantSchema],
      required: true,
      validate: {
        validator: function (participants: any[]) {
          return participants.length >= 2;
        },
        message: "A conversation must have at least 2 participants",
      },
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      // No default here - will be set in pre-save middleware based on type
    },
    initiated_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    last_message: {
      type: Schema.Types.ObjectId,
      ref: "Message", // Reference to Message collection
      required: false,
    },
    group_details: {
      type: groupDetailsSchema,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
conversationSchema.index({ "participants.user_id": 1 });
conversationSchema.index({ type: 1 });

// Pre-save middleware for validation
conversationSchema.pre("save", function (next) {
  // Set status based on conversation type (only for new documents)
  if (this.isNew && !this.status) {
    if (this.type === "DM") {
      this.status = "pending";
    } else if (this.type === "GROUP") {
      this.status = "accepted";
    }
  }

  // Validate DM conversations have exactly 2 participants
  if (this.type === "DM") {
    if (this.participants.length !== 2) {
      return next(
        new Error("DM conversations must have exactly 2 participants")
      );
    }
  }

  // Validate GROUP conversations
  if (this.type === "GROUP") {
    if (this.participants.length < 2) {
      return next(
        new Error("Group conversations must have at least 2 participants")
      );
    }
    // GROUP conversations must have group_details
    if (!this.group_details) {
      return next(new Error("Group conversations must have group details"));
    }
  }
  next();
});

// Static methods

// Find conversations with exactly the specified participants
conversationSchema.statics.findByParticipants = function (userIds: string[]) {
  return this.find({
    "participants.user_id": { $all: userIds },
    $expr: { $eq: [{ $size: "$participants" }, userIds.length] },
  });
};

// Get all conversations for a user with populated details, sorted by recent activity
conversationSchema.statics.findUserConversations = function (
  userId: string | any
) {
  return this.find({
    "participants.user_id": userId,
  })
    .populate("participants.user_id", "name email uid")
    .populate("initiated_by", "name email uid") // Populate who initiated the conversation
    .populate({
      path: "last_message",
      populate: {
        path: "sender_id",
        select: "name email uid",
      },
    })
    .sort({ updatedAt: -1 });
};

// Check if a DM conversation already exists between two specific users
conversationSchema.statics.findDMBetweenUsers = function (
  userId1: string | any,
  userId2: string | any
) {
  return this.findOne({
    type: "DM",
    "participants.user_id": { $all: [userId1, userId2] },
    $expr: { $eq: [{ $size: "$participants" }, 2] },
  });
};

// Find conversations initiated by a specific user
conversationSchema.statics.findConversationsInitiatedBy = function (
  userId: string
) {
  return this.find({
    initiated_by: userId,
  })
    .populate("participants.user_id", "name email uid")
    .populate("initiated_by", "name email uid")
    .populate({
      path: "last_message",
      populate: {
        path: "sender_id",
        select: "name email uid",
      },
    })
    .sort({ createdAt: -1 });
};

// Instance methods
conversationSchema.methods.addParticipant = function (
  userId: string,
  role: "member" | "admin" = "member"
) {
  // check if conversation is DM
  if (this.type === "DM") {
    // DM conversations can only have 2 participants
    if (this.participants.length <= 2) {
      throw new Error("DM conversations can only have 2 participants");
    }
  }

  const isAlreadyParticipant = this.participants.some(
    (p: any) => p.user_id.toString() === userId
  );

  if (!isAlreadyParticipant) {
    this.participants.push({
      user_id: userId,
      role: role,
    });
  }

  return this.save();
};

conversationSchema.methods.removeParticipant = function (userId: string) {
  this.participants = this.participants.filter(
    (p: any) => p.user_id.toString() !== userId
  );

  return this.save();
};

conversationSchema.methods.updateLastMessage = function (messageId: string) {
  this.last_message = messageId; // Store ObjectId reference to Message document
  return this.save();
};

conversationSchema.methods.isParticipant = function (userId: string) {
  return this.participants.some((p: any) => {
    // Handle both populated and non-populated cases
    const participantId =
      typeof p.user_id === "object" ? p.user_id._id : p.user_id;
    return participantId.toString() === userId.toString();
  });
};

conversationSchema.methods.getParticipantRole = function (userId: string) {
  const participant = this.participants.find((p: any) => {
    // Handle both populated and non-populated cases
    const participantId =
      typeof p.user_id === "object" ? p.user_id._id : p.user_id;
    return participantId.toString() === userId.toString();
  });
  return participant?.role || null;
};

// Create the base model
const Conversation = model<IConversation, ConversationModel>(
  "Conversation",
  conversationSchema
);

export default Conversation;
