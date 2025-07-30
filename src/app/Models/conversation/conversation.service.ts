import AppError from "../../errors/AppError";
import { User } from "../user/user.model";
import httpStatus from "http-status";
import Conversation from "./conversation.model";

const ConversationRequestServiceDM = async ({
  senderId,
  receiverEmail,
}: {
  senderId: string;
  receiverEmail: string;
}) => {
  //find receiver user by email
  const receiverUser = await User.findOne({ email: receiverEmail });
  if (!receiverUser) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User not found with the provided email"
    );
  }

  // Use MongoDB _id as ObjectId (don't convert to string)
  const senderUserId = senderId; // Keep as ObjectId
  const receiverUserId = receiverUser._id; // Keep as ObjectId

  // Check if users are trying to send request to themselves
  if (senderUserId.toString() === receiverUserId.toString()) {
    throw new Error("Cannot send conversation request to yourself");
  }

  // Check if conversation already exists between these users
  const existingConversation = await Conversation.findDMBetweenUsers(
    senderUserId,
    receiverUserId
  );

  if (existingConversation) {
    if (existingConversation.status === "pending") {
      throw new Error("Conversation request already pending");
    } else if (existingConversation.status === "accepted") {
      throw new Error("Conversation already exists between these users");
    } else if (existingConversation.status === "rejected") {
      // Update existing rejected conversation to pending
      existingConversation.status = "pending";
      return await existingConversation.save();
    }
  }

  // Create new conversation request using MongoDB _id
  const conversationRequest = new Conversation({
    type: "DM",
    participants: [
      { user_id: senderUserId, role: "initiator" },
      { user_id: receiverUserId, role: "receiver" },
    ],
    initiated_by: senderUserId, // Use MongoDB _id
    status: "pending", // Will be set automatically by pre-save middleware for DM
  });

  return await conversationRequest.save();
};

const respondToConversationRequestService = async ({
  conversationId,
  respondingUserId,
  action,
}: {
  conversationId: string;
  respondingUserId: string;
  action: "accepted" | "rejected";
}) => {
  // Find responding user by MongoDB _id
  const respondingUser = await User.findById(respondingUserId);
  if (!respondingUser) {
    throw new AppError(httpStatus.NOT_FOUND, "Responding user not found");
  }

  // Find the conversation request
  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    throw new AppError(httpStatus.NOT_FOUND, "Conversation request not found");
  }

  // Check if conversation is still pending
  if (conversation.status === "accepted") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Conversation request is already ${conversation.status}`
    );
  }

  // Check if the responding user is a participant using MongoDB _id
  const isParticipant = conversation.isParticipant(respondingUserId);

  if (!isParticipant) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to respond to this conversation request"
    );
  }

  // Update conversation status
  conversation.status = action;

  return await conversation.save();
};

const getAllConversationService = async (userId: string) => {
  // find all conversations where user is a participant using MongoDB _id
  const conversations = await Conversation.findUserConversations(userId);
  return conversations;
};

// get specific conversation by ID
const getConversationByIdService = async ({
  userId,
  conversationId,
}: {
  userId: string;
  conversationId: string;
}) => {
  // check if conversation exists first
  const foundConversation = await Conversation.findById(conversationId)
    .populate("participants.user_id", "name email uid")
    .populate("initiated_by", "name email")
    .populate({
      path: "last_message",
      populate: {
        path: "sender_id",
        select: "name email ",
      },
    });

  if (!foundConversation) {
    throw new AppError(httpStatus.NOT_FOUND, "Conversation not found");
  }

  // check if user is a participant in the conversation using MongoDB _id
  const isParticipant = foundConversation.isParticipant(userId);
  if (!isParticipant) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to access this conversation"
    );
  }

  return foundConversation;
};

//I'll do later about group conversation
const createGroupConversationService = async ({
  creatorId,
  participantIds,
  groupName,
  groupImage,
}: {
  creatorId: string;
  participantIds: string[]; // Array of user IDs to add to the group
  groupName: string;
  groupImage?: string;
}) => {
  // Validate that creator is included in participants
  if (!participantIds.includes(creatorId)) {
    participantIds.push(creatorId);
  }

  // Ensure minimum participants for group
  if (participantIds.length < 2) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Group conversations must have at least 2 participants"
    );
  }

  // Verify all participants exist
  const users = await User.find({ uid: { $in: participantIds } });
  if (users.length !== participantIds.length) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "One or more participants not found"
    );
  }

  // Create participants array with creator as admin
  const participants = participantIds.map((userId) => ({
    user_id: userId,
    role: userId === creatorId ? "admin" : "member",
  }));

  // Create new group conversation
  const groupConversation = new Conversation({
    type: "GROUP",
    participants,
    initiated_by: creatorId, // Track who created the group
    status: "accepted", // Groups are automatically accepted
    group_details: {
      name: groupName,
      image: groupImage,
    },
  });

  return await groupConversation.save();
};

export const ConversationService = {
  ConversationRequestServiceDM,
  respondToConversationRequestService,
  getAllConversationService,
  getConversationByIdService,
  createGroupConversationService,
};
