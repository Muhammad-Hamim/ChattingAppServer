import { Document, PopulatedDoc } from "mongoose";
import { TUser } from "../user/user.interface";
import { IConversation } from "../conversation/conversation.interface";

export type TMessageContent = {
  type: "text" | "image";
  content: string;
};

export interface TMessage extends Document {
  conversation_id: PopulatedDoc<IConversation>; // Reference to conversation
  sender_id: PopulatedDoc<TUser>; // Reference to user who sent the message
  type: "text" | "image";
  content: string;
  read_by: {
    user_id: PopulatedDoc<TUser>;
  }[];
  edited?: boolean;
  reply_to?: PopulatedDoc<TMessage>; // Reference to another message if this is a reply
}
