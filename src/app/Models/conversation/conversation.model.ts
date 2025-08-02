/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Schema, model } from "mongoose";
import {
  ConversationModel,
  IConversation,
  TParticipant,
  TUserConversationSettings,
  TReadReceipt,
  TBlockDetails,
  TGroupSettings,
} from "./conversation.interface";

// Participant sub-schema
const participantSchema = new Schema<TParticipant>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["member", "admin", "owner", "initiator", "receiver", "banned"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "left", "removed", "invited"],
    },
    nickname: {
      type: String,
      trim: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// User conversation settings sub-schema
const userSettingsSchema = new Schema<TUserConversationSettings>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    is_archived: {
      type: Boolean,
      default: false,
    },
    is_muted: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

// Read receipt sub-schema
const readReceiptSchema = new Schema<TReadReceipt>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    last_read_timestamp: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

// Block details sub-schema for DM conversations
const blockDetailsSchema = new Schema<TBlockDetails>(
  {
    is_blocked: {
      type: Boolean,
      required: true,
      default: false,
    },
    blocked_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    time: {
      type: Date,
      required: false,
    },
  },
  { _id: false }
);

// Group settings sub-schema
const groupSettingsSchema = new Schema<TGroupSettings>(
  {
    only_admin_can_post: {
      type: Boolean,
      default: false,
    },
    approval_required_to_join: {
      type: Boolean,
      default: false,
    },
    max_members: {
      type: Number,
      default: 256,
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
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    settings: {
      type: groupSettingsSchema,
      required: false,
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
    last_message: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      required: false,
    },
    conversation_status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      required: true,
      default: "pending",
    },
    initiated_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    initiated_at: {
      type: Date,
      required: true,
      default: Date.now,
    },
    responded_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    response_action: {
      type: String,
      enum: ["accepted", "rejected"],
      required: false,
    },
    response_time: {
      type: Date,
      required: false,
    },
    read_receipts: {
      type: [readReceiptSchema],
      required: false,
      default: [],
    },
    user_settings: {
      type: [userSettingsSchema],
      required: false,
      default: [],
    },
    message_ttl: {
      type: Number,
      required: false,
    },
    // DM specific fields
    receiver_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.type === "DM";
      },
    },
    initiator_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.type === "DM";
      },
    },
    block_details: {
      type: blockDetailsSchema,
      required: false,
    },
    // Group specific fields
    group_details: {
      type: groupDetailsSchema,
      required: function () {
        return this.type === "GROUP";
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
conversationSchema.index({ "participants.user_id": 1 });
conversationSchema.index({ type: 1 });
conversationSchema.index({ "read_receipts.user_id": 1 });
conversationSchema.index({ conversation_status: 1 });
conversationSchema.index({ initiated_by: 1 });
conversationSchema.index({ receiver_id: 1 });
conversationSchema.index({ initiator_id: 1 });

// Pre-save middleware for validation
conversationSchema.pre("save", function (next) {
  // Set conversation_status based on conversation type (only for new documents)
  if (this.isNew && !this.conversation_status) {
    if (this.type === "DM") {
      this.conversation_status = "pending";
    } else if (this.type === "GROUP") {
      this.conversation_status = "accepted";
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
        path: "sender",
        select: "name email uid",
      },
    })
    .sort({ createdAt: -1 });
};

// Instance methods
conversationSchema.methods.addParticipant = function (
  userId: string,
  conversationId: string,
  role: "member" | "admin" = "member"
) {
  // check if conversation is DM
  if (this.type === "DM") {
    // DM conversations can only have 2 participants
    throw new Error("DM conversations can only have 2 participants");
  }

  const isAlreadyParticipant = this.participants.some(
    (p: any) => p.user_id.toString() === userId
  );

  if (!isAlreadyParticipant) {
    this.participants.push({
      user_id: userId,
      role: role,
      status: "active",
      joinedAt: new Date(),
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
  this.last_message = messageId;
  // Use validateModifiedOnly to avoid re-validating required fields that weren't changed
  return this.save({ validateModifiedOnly: true });
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

// Methods for handling response history and status transitions
conversationSchema.methods.acceptConversation = function (userId: string) {
  // Check if user can accept (status must be pending or rejected)
  if (this.conversation_status === "accepted") {
    throw new Error("Conversation is already accepted");
  }

  // Set response fields
  this.responded_by = userId;
  this.response_action = "accepted";
  this.response_time = new Date();

  // Update status
  this.conversation_status = "accepted";
  return this.save();
};

conversationSchema.methods.rejectConversation = function (userId: string) {
  // Check if user can reject (status must be pending or accepted)
  if (this.conversation_status === "rejected") {
    throw new Error("Conversation is already rejected");
  }

  // Set response fields
  this.responded_by = userId;
  this.response_action = "rejected";
  this.response_time = new Date();

  // Update status
  this.conversation_status = "rejected";
  return this.save();
};

conversationSchema.methods.canAccept = function () {
  // User can accept if status is pending or rejected
  return (
    this.conversation_status === "pending" ||
    this.conversation_status === "rejected"
  );
};

conversationSchema.methods.canReject = function () {
  // User can reject if status is pending or accepted
  return (
    this.conversation_status === "pending" ||
    this.conversation_status === "accepted"
  );
};

// Methods for handling blocked details in DM conversations
conversationSchema.methods.blockConversation = function (blockedBy: string) {
  if (this.type !== "DM") {
    throw new Error("Only DM conversations can be blocked");
  }

  this.block_details = {
    is_blocked: true,
    blocked_by: blockedBy,
    time: new Date(),
  };

  return this.save();
};

conversationSchema.methods.unblockConversation = function () {
  if (this.type !== "DM") {
    throw new Error("Only DM conversations can be unblocked");
  }

  this.block_details = {
    is_blocked: false,
    time: new Date(),
  };

  return this.save();
};

conversationSchema.methods.isBlocked = function () {
  return this.block_details?.is_blocked === true;
}; // Methods for handling read receipts
conversationSchema.methods.markAsRead = function (userId: string) {
  const existingIndex = this.read_receipts.findIndex(
    (rs: any) => rs.user_id.toString() === userId.toString()
  );

  if (existingIndex >= 0) {
    // Update existing read receipt
    this.read_receipts[existingIndex].last_read_timestamp = new Date();
  } else {
    // Add new read receipt
    this.read_receipts.push({
      user_id: userId,
      last_read_timestamp: new Date(),
    });
  }

  return this.save();
};

conversationSchema.methods.getLastReadTimestamp = function (userId: string) {
  const readReceipt = this.read_receipts.find(
    (rs: any) => rs.user_id.toString() === userId.toString()
  );
  return readReceipt?.last_read_timestamp || null;
};

conversationSchema.methods.hasUnreadMessages = function (userId: string) {
  if (!this.last_message) return false;

  const lastReadTimestamp = this.getLastReadTimestamp(userId);
  if (!lastReadTimestamp) return true; // Never read

  // Compare with last message timestamp (assuming last_message has createdAt)
  return this.updatedAt > lastReadTimestamp;
};

// Create the base model
const Conversation = model<IConversation, ConversationModel>(
  "Conversation",
  conversationSchema
);

export default Conversation;
