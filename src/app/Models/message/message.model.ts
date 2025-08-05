/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Schema, model } from "mongoose";
import { TMessage, MessageModel } from "./message.interface";

// Main message schema
const messageSchema = new Schema<TMessage, MessageModel>(
  {
    conversation_id: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "video", "audio", "file", "system", "location"],
      required: true,
      default: "text",
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    caption: {
      type: String,
      required: false,
      trim: true,
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
      required: true,
    },
    edited: {
      type: Boolean,
      default: false,
    },
    edited_at: {
      type: Date,
      required: false,
    },
    reply_to: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      required: false,
    },
    metadata: {
      is_forwarded: {
        type: Boolean,
        default: false,
      },
      forwarded_from: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: false,
      },
      forwarded_time: {
        type: Date,
        required: false,
      },
      expires_at: {
        type: Date,
        required: false,
      },
    },
    reactions: [
      {
        user_id: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        emoji: {
          type: String,
          required: true,
        },
        reacted_at: {
          type: Date,
          required: true,
          default: Date.now,
        },
      },
    ],
    deleted_history: [
      {
        deleted_for: {
          type: String,
          enum: ["everyone", "me"],
          required: true,
        },
        user_id: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: false,
        },
        time: {
          type: Date,
          required: true,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
messageSchema.index({ conversation_id: 1, updatedAt: -1 }); // Messages by conversation by time
messageSchema.index({ conversation_id: 1, sender: 1, updatedAt: -1 }); // Messages by conversation and sender by time
messageSchema.index({ sender: 1, updatedAt: -1 }); // Messages by sender by time
messageSchema.index({ conversation_id: 1, status: 1 }); // Messages by conversation and status
messageSchema.index({ status: 1, updatedAt: -1 }); // Messages by status and time
messageSchema.index({ "deleted_history.user_id": 1 }); // Messages by deletion user
messageSchema.index({ "deleted_history.deleted_for": 1 }); // Messages by deletion type
messageSchema.index({ "reactions.user_id": 1 }); // Messages by reactions
messageSchema.index({ "metadata.expires_at": 1 }); // Messages by expiration
messageSchema.index({ reply_to: 1 }); // Messages by reply reference

// Text index for message search
messageSchema.index(
  { content: "text", caption: "text" },
  {
    partialFilterExpression: {
      $or: [{ type: "text" }, { caption: { $exists: true } }],
    },
  }
);

// Static methods
messageSchema.statics.findByConversation = function (
  conversationId: string,
  userId?: string,
  limit: number = 50,
  skip: number = 0
) {
  const query: any = { conversation_id: conversationId };

  // If userId provided, filter out messages deleted for this user
  if (userId) {
    query.$and = [
      {
        $or: [
          { deleted_history: { $size: 0 } }, // No deletion history
          { deleted_history: { $exists: false } }, // No deletion history field
          {
            $and: [
              { "deleted_history.deleted_for": { $ne: "everyone" } }, // Not deleted for everyone
              {
                $or: [
                  { "deleted_history.deleted_for": { $ne: "me" } }, // Not deleted for me
                  { "deleted_history.user_id": { $ne: userId } }, // Not deleted by this user
                ],
              },
            ],
          },
        ],
      },
    ];
  }

  return this.find(query)
    .populate("sender", "name email uid")
    .populate("reply_to", "content type")
    .sort({ createdAt: 1 })
    .limit(limit)
    .skip(skip);
};

messageSchema.statics.searchInConversation = function (
  conversationId: string,
  searchText: string,
  userId?: string
) {
  const query: any = {
    conversation_id: conversationId,
    $text: { $search: searchText },
  };

  // Apply same filtering logic for deleted messages
  if (userId) {
    query.$and = [
      {
        $or: [
          { deleted_history: { $size: 0 } },
          { deleted_history: { $exists: false } },
          {
            $and: [
              { "deleted_history.deleted_for": { $ne: "everyone" } },
              {
                $or: [
                  { "deleted_history.deleted_for": { $ne: "me" } },
                  { "deleted_history.user_id": { $ne: userId } },
                ],
              },
            ],
          },
        ],
      },
    ];
  }

  return this.find(query)
    .populate("sender", "name email uid")
    .sort({ score: { $meta: "textScore" } });
};

messageSchema.statics.getUnreadCount = function (
  conversationId: string,
  userId: string
) {
  return this.countDocuments({
    conversation_id: conversationId,
    status: { $in: ["sent", "delivered"] },
    sender: { $ne: userId },
    $or: [
      { deleted_history: { $size: 0 } },
      { deleted_history: { $exists: false } },
      {
        $and: [
          { "deleted_history.deleted_for": { $ne: "everyone" } },
          {
            $or: [
              { "deleted_history.deleted_for": { $ne: "me" } },
              { "deleted_history.user_id": { $ne: userId } },
            ],
          },
        ],
      },
    ],
  });
};

// Instance methods
messageSchema.methods.markAsDelivered = function () {
  if (this.status === "sent") {
    this.status = "delivered";
    return this.save();
  }
  return Promise.resolve(this);
};

messageSchema.methods.editContent = function (newContent: string) {
  this.content = newContent;
  this.edited = true;
  this.edited_at = new Date();
  return this.save();
};

messageSchema.methods.deleteForEveryone = function () {
  // Check if message is within 10 minutes
  const currentTime = new Date();
  const messageTime = new Date(this.createdAt);
  const timeDifference = currentTime.getTime() - messageTime.getTime();

  if (timeDifference > 600000) {
    // 10 minutes = 600000 milliseconds
    throw new Error(
      "Message can only be deleted for everyone within 10 minutes of sending"
    );
  }

  // Check if already deleted for everyone
  const alreadyDeletedForEveryone = this.deleted_history?.some(
    (deletion: any) => deletion.deleted_for === "everyone"
  );

  if (alreadyDeletedForEveryone) {
    throw new Error("Message is already deleted for everyone");
  }

  // Initialize deleted_history if it doesn't exist
  if (!this.deleted_history) {
    this.deleted_history = [];
  }

  // Add deletion record
  this.deleted_history.push({
    deleted_for: "everyone",
    user_id: this.sender,
    time: new Date(),
  });

  return this.save();
};

messageSchema.methods.deleteForUser = function (userId: string) {
  // Check if already deleted for this user
  const alreadyDeletedForUser = this.deleted_history?.some(
    (deletion: any) =>
      deletion.deleted_for === "me" &&
      deletion.user_id?.toString() === userId.toString()
  );

  if (alreadyDeletedForUser) {
    throw new Error("Message is already deleted for this user");
  }

  // Initialize deleted_history if it doesn't exist
  if (!this.deleted_history) {
    this.deleted_history = [];
  }

  // Add deletion record
  this.deleted_history.push({
    deleted_for: "me",
    user_id: userId,
    time: new Date(),
  });

  return this.save();
};

messageSchema.methods.isDeletedForUser = function (userId: string) {
  if (!this.deleted_history || this.deleted_history.length === 0) {
    return false;
  }

  // Check if deleted for everyone
  const deletedForEveryone = this.deleted_history.some(
    (deletion: any) => deletion.deleted_for === "everyone"
  );

  if (deletedForEveryone) {
    return true;
  }

  // Check if deleted for this specific user
  const deletedForUser = this.deleted_history.some(
    (deletion: any) =>
      deletion.deleted_for === "me" &&
      deletion.user_id?.toString() === userId.toString()
  );

  return deletedForUser;
};

messageSchema.methods.isEdited = function () {
  return this.edited || false;
};

// Create the model
const Message = model<TMessage, MessageModel>("Message", messageSchema);

export default Message;
