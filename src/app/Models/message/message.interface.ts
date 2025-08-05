import { Document, Model, PopulatedDoc } from "mongoose";
import { TUser } from "../user/user.interface";
import { IConversation } from "../conversation/conversation.interface";

export type TMessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "system"
  | "location";

/** Delivery status of the message */
export type TMessageStatus = "sent" | "delivered" | "read";

/** Soft delete tracking per user or for all */
export type TMessageDeleteRecord = {
  deleted_for: "me" | "everyone";
  user_id?: PopulatedDoc<TUser>;
  time: Date;
};

/** Reaction info for a message (e.g., ❤️ 👍 😮 etc.) */
export type TReaction = {
  user_id: PopulatedDoc<TUser>;
  emoji: string;
  reacted_at: Date;
};

/** Optional metadata for forwarded or system messages */
export type TMessageMeta = {
  is_forwarded?: boolean;
  forwarded_from?: PopulatedDoc<TUser>;
  forwarded_time?: Date;

  // Optional fields for ephemeral messages (auto-delete)
  expires_at?: Date;
};

/**
 * Main interface for a Message document.
 */
export interface TMessage extends Document {
  /** The parent conversation ID */
  conversation_id: PopulatedDoc<IConversation>;

  /** The user who sent the message */
  sender: PopulatedDoc<TUser>;

  /** Type of message: text, image, video, etc. */
  type: TMessageType;

  /** The main content (text, URL of media, system note, etc.) */
  content: string;

  /** Optional caption for media content */
  caption?: string;

  /** Message delivery status */
  status: TMessageStatus;

  /** Indicates whether the message has been edited */
  edited: boolean;

  /** Timestamp of last edit (if any) */
  edited_at?: Date;

  /** If the message is a reply, reference to the original */
  reply_to?: PopulatedDoc<TMessage>;

  /** Optional metadata for advanced message features */
  metadata?: TMessageMeta;

  /** Reactions to the message */
  reactions?: TReaction[];

  /** Soft delete record */
  deleted_history?: TMessageDeleteRecord[];
  createdAt?: Date;
  updatedAt?: Date;
  /** Instance methods */
  markAsDelivered(): Promise<TMessage>;
  editContent(newContent: string): Promise<TMessage>;
  deleteForEveryone(): Promise<TMessage>;
  deleteForUser(userId: string): Promise<TMessage>;
  isDeletedForUser(userId: string): boolean;
  isEdited(): boolean;
}
export interface MessageModel extends Model<TMessage> {
  /**
   * Fetch messages in a conversation, excluding deleted messages for user
   */
  findByConversation(
    conversationId: string,
    userId?: string,
    limit?: number,
    skip?: number
  ): Promise<TMessage[]>;

  /**
   * Search messages in a conversation
   */
  searchInConversation(
    conversationId: string,
    searchText: string,
    userId?: string
  ): Promise<TMessage[]>;

  /**
   * Count unread messages in a conversation for a user
   */
  getUnreadCount(conversationId: string, userId: string): Promise<number>;

  /**
   * Count total messages in a conversation
   */
  getTotalMessageCount(conversationId: string): Promise<number>;

  /**
   * Get last N messages before a specific message for pagination
   */
  getPreviousMessages(
    conversationId: string,
    beforeMessageId: string,
    limit?: number
  ): Promise<TMessage[]>;
}
