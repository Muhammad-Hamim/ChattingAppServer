import mongoose from "mongoose";
import AppError from "../../errors/AppError";
import Conversation from "../conversation/conversation.model";
import Message from "./message.model";
import httpStatus from "http-status";
import { TMessageType } from "./message.interface";
import QueryBuilder from "../../builder/QuiryBuilder";

const getConversationMessagesService = async ({
  conversationId,
  userId,
  query,
}: {
  conversationId: string;
  userId: string;
  query: Record<string, unknown>;
}): Promise<{
  messages: unknown[];
  totalCount: number;
}> => {
  // Check if conversationId exists
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new AppError(httpStatus.NOT_FOUND, "Conversation not found");
  }
  if (conversation.conversation_status !== "accepted") {
    throw new AppError(httpStatus.FORBIDDEN, "Conversation is not accepted");
  }
  // Check if user is a participant
  const isParticipant = conversation.isParticipant(userId);
  if (!isParticipant) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to view this conversation"
    );
  }

  const conversationObjectId = new mongoose.Types.ObjectId(conversationId);
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // Build aggregation pipeline (business logic only, no pagination/sorting)
  const aggregationPipeline: mongoose.PipelineStage[] = [
    // Match messages for this specific conversation
    {
      $match: {
        conversation_id: conversationObjectId,
      },
    },
    // Add logic to check deletion status based on deleted_history
    {
      $addFields: {
        // Check if message is deleted for everyone
        deletedForEveryone: {
          $cond: {
            if: {
              $anyElementTrue: {
                $map: {
                  input: { $ifNull: ["$deleted_history", []] },
                  as: "deletion",
                  in: { $eq: ["$$deletion.deleted_for", "everyone"] },
                },
              },
            },
            then: true,
            else: false,
          },
        },
        // Determine if message should be hidden completely
        shouldHideMessage: {
          $cond: {
            if: {
              $anyElementTrue: {
                $map: {
                  input: { $ifNull: ["$deleted_history", []] },
                  as: "deletion",
                  in: {
                    $and: [
                      { $eq: ["$$deletion.deleted_for", "me"] },
                      { $eq: ["$$deletion.user_id", userObjectId] },
                    ],
                  },
                },
              },
            },
            then: true,
            else: false,
          },
        },
      },
    },
    // Filter out messages that are deleted for current user only
    {
      $match: {
        shouldHideMessage: false,
      },
    },
    // Populate sender information
    {
      $lookup: {
        from: "users",
        localField: "sender",
        foreignField: "_id",
        as: "sender",
      },
    },
    {
      $unwind: "$sender",
    },
    // Populate reply_to information
    {
      $lookup: {
        from: "messages",
        localField: "reply_to",
        foreignField: "_id",
        as: "reply_to_info",
      },
    },
    // Populate reactions user info
    {
      $lookup: {
        from: "users",
        localField: "reactions.user_id",
        foreignField: "_id",
        as: "reaction_users",
      },
    },
    // Add content display logic
    {
      $addFields: {
        displayContent: {
          $cond: {
            if: "$deletedForEveryone",
            then: "This message was deleted",
            else: "$content",
          },
        },
        canDeleteForEveryone: {
          $cond: {
            if: { $eq: ["$sender._id", userObjectId] },
            then: {
              // Check if message is within 10 minutes (600000 milliseconds)
              $lt: [{ $subtract: [new Date(), "$createdAt"] }, 600000],
            },
            else: false,
          },
        },
        canDeleteForMe: true,
        reply_to: {
          $cond: {
            if: { $gt: [{ $size: "$reply_to_info" }, 0] },
            then: { $arrayElemAt: ["$reply_to_info", 0] },
            else: null,
          },
        },
        // Map reactions with user info
        reactions: {
          $map: {
            input: "$reactions",
            as: "reaction",
            in: {
              emoji: "$$reaction.emoji",
              reacted_at: "$$reaction.reacted_at",
              user: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$reaction_users",
                      cond: { $eq: ["$$this._id", "$$reaction.user_id"] },
                    },
                  },
                  0,
                ],
              },
            },
          },
        },
      },
    },
    // Clean up temporary fields
    {
      $project: {
        shouldHideMessage: 0,
        reply_to_info: 0,
        reaction_users: 0,
        deletedForEveryone: 0,
      },
    },
  ];

  // Create base aggregation query
  const baseQuery = Message.aggregate(aggregationPipeline);

  // Use QueryBuilder to handle sorting, pagination, filtering and search
  const messageQuery = new QueryBuilder(baseQuery, query, "aggregate")
    .filter() // Apply any additional filters from query params
    .search(["content"]) // Enable search on message content
    .sort() // Handle sorting (defaults to -createdAt)
    .paginate(); // Handle pagination

  // Execute the query
  const messages = await messageQuery.execute();

  // Get total count for pagination (separate query without pagination)
  const countPipeline = aggregationPipeline.slice(0, 3); // Only match stages for counting
  const totalCountResult = await Message.aggregate([
    ...countPipeline,
    { $count: "count" },
  ]);

  const totalCount =
    totalCountResult.length > 0 ? totalCountResult[0].count : 0;

  return {
    messages: messages || [],
    totalCount,
  };
};

const sendMessageService = async ({
  conversationId,
  senderId,
  content,
  type = "text",
  caption,
  replyTo,
  metadata,
}: {
  conversationId: string;
  senderId: string;
  content: string;
  type?: TMessageType;
  caption?: string;
  replyTo?: string;
  metadata?: {
    is_forwarded?: boolean;
    forwarded_from?: string;
    expires_at?: Date;
  };
}): Promise<unknown> => {
  // Verify conversation exists and user is participant
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new AppError(httpStatus.NOT_FOUND, "Conversation not found");
  }

  const isParticipant = conversation.isParticipant(senderId);
  if (!isParticipant) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to send messages in this conversation"
    );
  }
  //check conversation status
  if (conversation.conversation_status !== "accepted") {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Cannot send messages in a conversation that is not accepted"
    );
  }
  // Validate reply_to message if provided
  if (replyTo) {
    const replyToMessage = await Message.findById(replyTo);
    if (!replyToMessage) {
      throw new AppError(httpStatus.NOT_FOUND, "Reply message not found");
    }

    if (replyToMessage.conversation_id?.toString() !== conversationId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Reply message must be from the same conversation"
      );
    }
  }

  // Create new message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messageData: Record<string, any> = {
    conversation_id: new mongoose.Types.ObjectId(conversationId),
    sender: new mongoose.Types.ObjectId(senderId),
    content,
    type,
    status: "sent" as const,
    edited: false,
    deleted_history: [],
  };

  // Add optional fields
  if (caption) messageData.caption = caption;
  if (replyTo) messageData.reply_to = new mongoose.Types.ObjectId(replyTo);
  if (metadata) {
    messageData.metadata = {
      is_forwarded: metadata.is_forwarded || false,
      forwarded_from: metadata.forwarded_from,
      forwarded_time: metadata.is_forwarded ? new Date() : undefined,
      expires_at: metadata.expires_at,
    };
  }

  const message = new Message(messageData);
  await message.save();

  // Update conversation's last message
  const savedMessage = message as unknown as { _id: { toString(): string } };

  try {
    await conversation.updateLastMessage(savedMessage._id.toString());
  } catch (error) {
    // Continue execution even if updating last message fails
    // The message was sent successfully, but conversation update failed
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Message sent but failed to update conversation: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  // Populate sender info before returning
  await message.populate("sender", "name email uid");
  if (replyTo) {
    await message.populate("reply_to", "content type sender");
  }

  return message;
};

const editMessageService = async ({
  messageId,
  userId,
  newContent,
}: {
  messageId: string;
  userId: string;
  newContent: string;
}): Promise<unknown> => {
  const message = await Message.findById(messageId);
  if (!message) {
    throw new AppError(httpStatus.NOT_FOUND, "Message not found");
  }

  // Check if user is the sender
  const senderId =
    typeof message.sender === "object" ? message.sender._id : message.sender;
  if (!senderId || senderId.toString() !== userId.toString()) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only the sender can edit the message"
    );
  }

  // Check if message is deleted for everyone
  const deletedForEveryone = message.deleted_history?.some(
    (deletion) => deletion.deleted_for === "everyone"
  );

  if (deletedForEveryone) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot edit a message that has been deleted for everyone"
    );
  }

  await message.editContent(newContent);
  return message;
};

const deleteMessageForEveryoneService = async ({
  messageId,
  userId,
}: {
  messageId: string;
  userId: string;
}): Promise<unknown> => {
  // Find the message
  const message = await Message.findById(messageId);
  if (!message) {
    throw new AppError(httpStatus.NOT_FOUND, "Message not found");
  }

  // Check if user is the sender
  const senderId =
    typeof message.sender === "object" ? message.sender._id : message.sender;
  if (!senderId || senderId.toString() !== userId.toString()) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only the sender can delete the message for everyone"
    );
  }

  // Use the model's instance method
  await message.deleteForEveryone();
  return message;
};

const deleteMessageForMeService = async ({
  messageId,
  userId,
}: {
  messageId: string;
  userId: string;
}): Promise<unknown> => {
  // Find the message
  const message = await Message.findById(messageId);
  if (!message) {
    throw new AppError(httpStatus.NOT_FOUND, "Message not found");
  }

  // Use the model's instance method
  await message.deleteForUser(userId);
  return message;
};

const addReactionService = async ({
  messageId,
  userId,
  emoji,
}: {
  messageId: string;
  userId: string;
  emoji: string;
}): Promise<unknown> => {
  const message = await Message.findById(messageId);
  if (!message) {
    throw new AppError(httpStatus.NOT_FOUND, "Message not found");
  }

  // Check if user already reacted with this emoji
  const existingReactionIndex = message.reactions?.findIndex(
    (reaction) =>
      reaction.user_id?.toString() === userId.toString() &&
      reaction.emoji === emoji
  );

  if (existingReactionIndex !== undefined && existingReactionIndex >= 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You have already reacted with this emoji"
    );
  }

  // Initialize reactions array if it doesn't exist
  if (!message.reactions) {
    message.reactions = [];
  }

  // Add new reaction
  message.reactions.push({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user_id: new mongoose.Types.ObjectId(userId) as any,
    emoji,
    reacted_at: new Date(),
  });

  await message.save();
  return message;
};

const removeReactionService = async ({
  messageId,
  userId,
  emoji,
}: {
  messageId: string;
  userId: string;
  emoji: string;
}): Promise<unknown> => {
  const message = await Message.findById(messageId);
  if (!message) {
    throw new AppError(httpStatus.NOT_FOUND, "Message not found");
  }

  // Find and remove the reaction
  if (message.reactions) {
    message.reactions = message.reactions.filter(
      (reaction) =>
        !(
          reaction.user_id?.toString() === userId.toString() &&
          reaction.emoji === emoji
        )
    );
  }

  await message.save();
  return message;
};

export const MessageService = {
  getConversationMessagesService,
  sendMessageService,
  editMessageService,
  deleteMessageForEveryoneService,
  deleteMessageForMeService,
  addReactionService,
  removeReactionService,
};
