import { Document, Model, PopulatedDoc, Query } from "mongoose";
import { TUser } from "../user/user.interface";
import { TMessage } from "../message/message.interface";

/** Participant structure for both DM and Group chats */
export type TParticipant = {
  user_id: PopulatedDoc<TUser>;
  role: "member" | "admin" | "owner" | "initiator" | "receiver" | "banned";
  status?: "active" | "left" | "removed" | "invited"; // group dynamics
  nickname?: string;
  joinedAt?: Date;
};

/** Per-user custom settings like archive/mute */
export type TUserConversationSettings = {
  user_id: PopulatedDoc<TUser>;
  is_archived?: boolean;
  is_muted?: boolean;
};

/** Read receipts for each user */
export type TReadReceipt = {
  user_id: PopulatedDoc<TUser>;
  last_read_timestamp: Date;
};

/** Optional block info for DM */
export type TBlockDetails = {
  is_blocked: boolean;
  blocked_by?: PopulatedDoc<TUser>;
  time?: Date;
};

/** Optional group control features */
export type TGroupSettings = {
  only_admin_can_post?: boolean;
  approval_required_to_join?: boolean;
  max_members?: number;
};

/** Common conversation fields shared by DM and Group */
interface IConversationBase extends Document {
  type: "DM" | "GROUP";

  // Members and metadata
  participants: TParticipant[];

  // Latest message reference for sorting/convenience
  last_message?: PopulatedDoc<TMessage>;

  // Track whether a DM is accepted or rejected
  conversation_status: "pending" | "accepted" | "rejected";

  // Who created the conversation and when
  initiated_by: PopulatedDoc<TUser>;
  initiated_at: Date;

  // Who responded and how
  responded_by?: PopulatedDoc<TUser>;
  response_action?: "accepted" | "rejected";
  response_time?: Date;

  // User read receipts
  read_receipts?: TReadReceipt[];

  // Per-user mute/archive preferences
  user_settings?: TUserConversationSettings[];

  // Auto-deletion feature
  message_ttl?: number; // in seconds

  createdAt?: Date;
  updatedAt?: Date;
}

/** One-to-One DM Conversation */
export interface IDMConversation extends IConversationBase {
  type: "DM";
  receiver_id: PopulatedDoc<TUser>;
  initiator_id: PopulatedDoc<TUser>;
  block_details?: TBlockDetails;
}

/** Group Conversation */
export interface IGroupConversation extends IConversationBase {
  type: "GROUP";
  group_details: {
    name: string;
    image?: string;
    description?: string;
    settings?: TGroupSettings;
  };
}

/** Unified type for all conversation types */
export type IConversation = IDMConversation | IGroupConversation;

export interface ConversationStatic extends Model<IConversation> {
  /** Find all conversations where given user is a participant */
  findByParticipants(userIds: string[]): Query<IConversation[], IConversation>;

  /** Find all conversations initiated by a specific user */
  findConversationsInitiatedBy(
    userId: string
  ): Query<IConversation[], IConversation>;

  /** Get DM between two users */
  findDMBetweenUsers(
    userId1: string,
    userId2: string
  ): Query<IConversation | null, IConversation>;
}
export interface ConversationMethods {
  /** Add participant to conversation */
  addParticipant(
    userId: string,
    conversationId: string,
    role?: "member" | "admin"
  ): Promise<IConversation>;

  /** Remove participant from group */
  removeParticipant(userId: string): Promise<IConversation>;

  /** Update last message (called when new message is sent) */
  updateLastMessage(messageId: string): Promise<IConversation>;

  /** Check if user is in the conversation */
  isParticipant(userId: string): boolean;

  /** Get role of a participant */
  getParticipantRole(userId: string): TParticipant["role"] | null;

  /** Accept a pending DM request */
  acceptConversation(userId: string): Promise<IConversation>;

  /** Reject a pending DM request */
  rejectConversation(userId: string): Promise<IConversation>;

  /** Check if conversation is eligible to accept */
  canAccept(): boolean;

  /** Check if conversation is eligible to reject */
  canReject(): boolean;

  /** Block the conversation (DM only) */
  blockConversation(blockedBy: string): Promise<IConversation>;

  /** Unblock the conversation */
  unblockConversation(): Promise<IConversation>;

  /** Check if conversation is blocked */
  isBlocked(): boolean;

  /** Mark a conversation as read for a user */
  markAsRead(userId: string): Promise<IConversation>;

  /** Get timestamp of last read message */
  getLastReadTimestamp(userId: string): Date | null;

  /** Check if a user has unread messages */
  hasUnreadMessages(userId: string): boolean;
}
export type ConversationModel = Model<
  IConversation,
  Record<string, never>,
  ConversationMethods
> &
  ConversationStatic;
