// types.ts

import { Document, Model, PopulatedDoc } from "mongoose";
import { TUser } from "../user/user.interface";
import { TMessage } from "../message/message.interface";

export type TParticipants = {
  user_id: PopulatedDoc<TUser>;
  role?: "member" | "admin" | "initiator" | "receiver"; // Role in the conversation
};

// Base interface that all conversations share
interface IConversationBase extends Document {
  participants: TParticipants[];
  last_message?: PopulatedDoc<TMessage>; // Reference to message collection
  status: "pending" | "accepted" | "rejected"; // Status of the conversation
  initiated_by: PopulatedDoc<TUser>; // User who created/initialized the conversation
}

// Interface for a One-to-One DM
export interface IDMConversation extends IConversationBase {
  type: "DM";
  // No group_details here
}

// Interface for a Group Chat
export interface IGroupConversation extends IConversationBase {
  type: "GROUP";
  group_details: {
    name: string;
    image?: string;
  };
}

// The final discriminated union type
export type IConversation = IDMConversation | IGroupConversation;

//for creating static
export interface ConversationStatic extends Model<IConversation> {
  findByParticipants(userIds: string[]): Promise<IConversation[]>;
  findConversationsInitiatedBy(userId: string): Promise<IConversation[]>;
  findUserConversations(userId: string): Promise<IConversation[]>;
  findDMBetweenUsers(
    userId1: string,
    userId2: string
  ): Promise<IConversation | null>;
}

export interface ConversationMethods {
  addParticipant(
    userId: string,
    conversationId: string,
    role?: "member" | "admin"
  ): Promise<IConversation>;
  removeParticipant(userId: string): Promise<IConversation>;
  updateLastMessage(messageId: PopulatedDoc<TMessage>): Promise<IConversation>;
  isParticipant(userId: string): boolean;
  getParticipantRole(userId: string): "member" | "admin" | undefined;
}

export type ConversationModel = Model<
  IConversation,
  Record<string, never>,
  ConversationMethods
> &
  ConversationStatic;
