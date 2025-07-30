import { Schema, model } from "mongoose";
import { TMessage } from "./message.interface";

// Read status sub-schema
const readStatusSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { _id: false, timestamps: { createdAt: "read_at" } }
);

// Main message schema
const messageSchema = new Schema<TMessage>(
  {
    conversation_id: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true, // Index for efficient conversation queries
    },
    sender_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Index for sender queries
    },
    type: {
      type: String,
      enum: ["text", "image"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    read_by: {
      type: [readStatusSchema],
      default: [],
      ref: "User", // Reference to User collection
    },
    edited: {
      type: Boolean,
      default: false,
    },
    reply_to: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);


messageSchema.index({ sender_id: 1, timestamp: -1 }); // Messages by sender by time
messageSchema.index({ conversation_id: 1, type: 1 }); // Messages by conversation and type

// Text index for message search
messageSchema.index(
  { content: "text" },
  {
    partialFilterExpression: { type: "text" }, // Only index text messages
  }
);

// Static methods
messageSchema.statics.findByConversation = function (
  conversationId: string,
  limit: number = 50,
  skip: number = 0
) {
  return this.find({ conversation_id: conversationId })
    .populate("sender_id", "name email avatar")
    .populate("reply_to")
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip);
};

messageSchema.statics.searchInConversation = function (
  conversationId: string,
  searchText: string
) {
  return this.find({
    conversation_id: conversationId,
    $text: { $search: searchText },
  })
    .populate("sender_id", "name email avatar")
    .sort({ score: { $meta: "textScore" } });
};

messageSchema.statics.getUnreadCount = function (
  conversationId: string,
  userId: string
) {
  return this.countDocuments({
    conversation_id: conversationId,
    "read_by.user_id": { $ne: userId },
  });
};

// Instance methods
messageSchema.methods.markAsRead = function (userId: string) {
  const alreadyRead = this.read_by.some(
    (read: any) => read.user_id.toString() === userId
  );

  if (!alreadyRead) {
    this.read_by.push({
      user_id: userId,
      read_at: new Date(),
    });
    return this.save();
  }

  return Promise.resolve(this);
};

messageSchema.methods.editContent = function (newContent: string) {
  this.content = newContent;
  this.edited = true;
  return this.save();
};

messageSchema.methods.isReadBy = function (userId: string) {
  return this.read_by.some((read: any) => read.user_id.toString() === userId);
};

// Create the model
const Message = model<TMessage>("Message", messageSchema);

export default Message;
