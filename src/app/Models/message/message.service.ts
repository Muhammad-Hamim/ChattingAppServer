import mongoose from "mongoose";
import AppError from "../../errors/AppError";
import Conversation from "../conversation/conversation.model";
import Message from "./message.model";
import httpStatus from "http-status";
import { TMessageType } from "./message.interface";
import QueryBuilder from "../../builder/QuiryBuilder";
import { conversationMessageAggregation } from "./messages.aggregation";

const getConversationMessagesService = async ({
  conversationId,
  userId,
  query,
}: {
  conversationId: string;
  userId: string;
  query: Record<string, unknown>;
}): Promise<unknown[]> => {
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

  //get the aggregation pipeline
  const pipeline = conversationMessageAggregation({
    conversationObjectId,
    userObjectId,
  });
  //message base query
  const messageQuery = Message.aggregate(pipeline as mongoose.PipelineStage[]);
  // Apply query builder if query is provided
  const messages = await new QueryBuilder(messageQuery, query, "aggregate")
    .sort()
    .paginate()
    .search(["content"])
    .execute();

  return messages || [];
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

  // Populate sender info and reply_to before returning with all required fields
  await message.populate("sender", "_id uid name email");
  if (replyTo) {
    await message.populate({
      path: "reply_to",
      select: "_id content type sender createdAt",
      populate: {
        path: "sender",
        select: "_id uid name email",
      },
    });
  }

  return message;
};

const updateMessageStatus = async ({
  messageId,
  status,
  user_id,
}: {
  messageId: string;
  status: "sent" | "delivered" | "read";
  user_id: string;
}): Promise<unknown> => {
  const message = await Message.findById(messageId);
  const conversation = await Conversation.findById(message?.conversation_id);
  const isParticipant = conversation?.isParticipant(user_id);
  if (!isParticipant) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not a participant in this conversation"
    );
  }
  if (!message) {
    throw new AppError(httpStatus.NOT_FOUND, "Message not found");
  }

  message.status = status;
  await message.save();
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
  updateMessageStatus,
  editMessageService,
  deleteMessageForEveryoneService,
  deleteMessageForMeService,
  addReactionService,
  removeReactionService,
};
