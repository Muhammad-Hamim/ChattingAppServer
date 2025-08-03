/* eslint-disable @typescript-eslint/explicit-function-return-type */
import AppError from "../../errors/AppError";
import { User } from "../user/user.model";
import httpStatus from "http-status";
import Conversation from "./conversation.model";
import QueryBuilder from "../../builder/QuiryBuilder";
import mongoose from "mongoose";

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
    if (existingConversation.conversation_status === "pending") {
      throw new Error("Conversation request already pending");
    } else if (existingConversation.conversation_status === "accepted") {
      throw new Error("Conversation already exists between these users");
    } else if (existingConversation.conversation_status === "rejected") {
      // Update existing rejected conversation to pending
      existingConversation.conversation_status = "pending";
      return await existingConversation.save();
    }
  }

  // Create new conversation request using MongoDB _id
  const conversationRequest = new Conversation({
    type: "DM",
    participants: [
      { user_id: senderUserId, role: "initiator", status: "active" },
      { user_id: receiverUserId, role: "receiver", status: "active" },
    ],
    initiated_by: senderUserId,
    initiated_at: new Date(),
    conversation_status: "pending",
    receiver_id: receiverUserId,
    initiator_id: senderUserId,
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
  if (conversation.conversation_status === "accepted") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Conversation request is already ${conversation.conversation_status}`
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

  // Update conversation status and track response
  if (action === "accepted") {
    return await conversation.acceptConversation(respondingUserId);
  } else {
    return await conversation.rejectConversation(respondingUserId);
  }
};

const getAllConversationService = async ({
  userId,
  query,
}: {
  userId: string;
  query: Record<string, unknown>;
}) => {
  // Convert userId to ObjectId for proper matching
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // Custom aggregation pipeline for conversation list
  const aggregationPipeline = [
    // Match conversations where user is a participant
    {
      $match: {
        "participants.user_id": userObjectId,
      },
    },
    // Populate participants
    {
      $lookup: {
        from: "users",
        localField: "participants.user_id",
        foreignField: "_id",
        as: "participantUsers",
      },
    },
    //populate last message
    {
      $lookup: {
        from: "messages",
        localField: "last_message",
        foreignField: "_id",
        as: "lastMessage",
      },
    },
    // Populate sender information for last message
    {
      $lookup: {
        from: "users",
        localField: "lastMessage.sender",
        foreignField: "_id",
        as: "lastMessageSender",
      },
    },
    // Add computed fields based on conversation type
    {
      $addFields: {
        displayInfo: {
          $cond: {
            if: { $eq: ["$type", "DM"] },
            then: {
              // For DM: filter out the current user and get the other participant
              $let: {
                vars: {
                  otherParticipant: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$participantUsers",
                          cond: { $ne: ["$$this._id", userObjectId] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: {
                  name: "$$otherParticipant.name",
                  email: "$$otherParticipant.email",
                  uid: "$$otherParticipant.uid",
                },
              },
            },
            else: {
              // For GROUP: return group details
              name: "$group_details.name",
              image: "$group_details.image",
            },
          },
        },
        // Format last message with only required fields
        formattedLastMessage: {
          $cond: {
            if: { $gt: [{ $size: "$lastMessage" }, 0] },
            then: {
              sender_name: {
                $arrayElemAt: ["$lastMessageSender.name", 0],
              },
              sender_email: {
                $arrayElemAt: ["$lastMessageSender.email", 0],
              },
              type: {
                $arrayElemAt: ["$lastMessage.type", 0],
              },
              content: {
                $arrayElemAt: ["$lastMessage.content", 0],
              },

              updatedAt: {
                $arrayElemAt: ["$lastMessage.updatedAt", 0],
              },
            },
            else: null,
          },
        },
      },
    },
    // Project only the required fields
    {
      $project: {
        _id: 1,
        type: 1,
        participants: "$displayInfo",
        block_details: 1,
        conversation_status: 1,
        last_message: "$formattedLastMessage",
        createdAt: 1,
        updatedAt: 1,
      },
    },
    // Sort by most recent activity
    {
      $sort: { updatedAt: -1 as const },
    },
  ];

  // Create aggregation query
  const baseQuery = Conversation.aggregate(aggregationPipeline);

  // Pass the aggregation to QueryBuilder
  const conversationQuery = new QueryBuilder(baseQuery, query, "aggregate")
    .filter()
    .sort()
    .paginate();

  return await conversationQuery.execute();
};

// get specific conversation by ID
const getConversationByIdService = async ({
  userId,
  conversationId,
}: {
  userId: string;
  conversationId: string;
}) => {
  // Convert userId to ObjectId for proper matching
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // Custom aggregation pipeline for specific conversation
  const aggregationPipeline = [
    // Match the conversation by ID
    { $match: { _id: new mongoose.Types.ObjectId(conversationId) } },

    // Check if user is a participant (early filter)
    {
      $match: {
        "participants.user_id": userObjectId,
      },
    },

    // Populate participants
    {
      $lookup: {
        from: "users",
        localField: "participants.user_id",
        foreignField: "_id",
        as: "participantUsers",
      },
    },

    // Populate last message
    {
      $lookup: {
        from: "messages",
        localField: "last_message",
        foreignField: "_id",
        as: "lastMessage",
      },
    },
    // Populate sender information for last message
    {
      $lookup: {
        from: "users",
        localField: "lastMessage.sender",
        foreignField: "_id",
        as: "lastMessageSender",
      },
    },

    // Add computed fields based on conversation type
    {
      $addFields: {
        displayInfo: {
          $cond: {
            if: { $eq: ["$type", "DM"] },
            then: {
              // For DM: filter out the current user and get the other participant
              $let: {
                vars: {
                  otherParticipant: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$participantUsers",
                          cond: { $ne: ["$$this._id", userObjectId] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: {
                  name: "$$otherParticipant.name",
                  email: "$$otherParticipant.email",
                  uid: "$$otherParticipant.uid",
                },
              },
            },
            else: {
              // For GROUP: return group details
              name: "$group_details.name",
              image: "$group_details.image",
            },
          },
        },
        // Format last message with only required fields
        formattedLastMessage: {
          $cond: {
            if: { $gt: [{ $size: "$lastMessage" }, 0] },
            then: {
              sender_name: {
                $arrayElemAt: ["$lastMessageSender.name", 0],
              },
              content: {
                $arrayElemAt: ["$lastMessage.content", 0],
              },
              updatedAt: {
                $arrayElemAt: ["$lastMessage.updatedAt", 0],
              },
            },
            else: null,
          },
        },
      },
    },

    // Project only the required fields
    {
      $project: {
        _id: 1,
        type: 1,
        participants: "$displayInfo",
        conversation_status: 1,
        block_details: 1,
        group_details: 1,
        read_receipts: 1,
        last_message: "$formattedLastMessage",
        initiated_by: 1,
        initiated_at: 1,
        responded_by: 1,
        response_action: 1,
        response_time: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ];

  // Execute aggregation
  const result = await Conversation.aggregate(aggregationPipeline);

  // Check if conversation exists and user has access
  if (!result || result.length === 0) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Conversation not found or you don't have access to it"
    );
  }

  return result[0]; // Return the first (and only) result
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
    status: "active",
    joinedAt: new Date(),
  }));

  // Create new group conversation
  const groupConversation = new Conversation({
    type: "GROUP",
    participants,
    initiated_by: creatorId,
    initiated_at: new Date(),
    conversation_status: "accepted", // Groups are automatically accepted
    group_details: {
      name: groupName,
      image: groupImage,
    },
  });

  return await groupConversation.save();
};

// Block/Unblock DM conversation service
const blockConversationService = async ({
  conversationId,
  userId,
  action,
}: {
  conversationId: string;
  userId: string;
  action: "block" | "unblock";
}) => {
  // Find the conversation
  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    throw new AppError(httpStatus.NOT_FOUND, "Conversation not found");
  }

  // Check if it's a DM conversation
  if (conversation.type !== "DM") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only DM conversations can be blocked/unblocked"
    );
  }

  // Check if user is a participant
  const isParticipant = conversation.isParticipant(userId);
  if (!isParticipant) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to modify this conversation"
    );
  }

  // Perform the action
  if (action === "block") {
    return await conversation.blockConversation(userId);
  } else {
    return await conversation.unblockConversation();
  }
};

export const ConversationService = {
  ConversationRequestServiceDM,
  respondToConversationRequestService,
  getAllConversationService,
  getConversationByIdService,
  createGroupConversationService,
  blockConversationService,
};
