import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import httpStatus from "http-status";
import { ConversationService } from "./conversation.service";

const createDMConversation = catchAsync(async (req, res) => {
  const { receiverEmail } = req.body;
  const result = await ConversationService.ConversationRequestServiceDM({
    senderId: req.user._id as string, // Use MongoDB _id
    receiverEmail,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Conversation request sent successfully",
    data: result,
  });
});

const respondToConversationRequest = catchAsync(async (req, res) => {
  const { action } = req.body;
  const { conversationId } = req.params;

  const result = await ConversationService.respondToConversationRequestService({
    conversationId,
    respondingUserId: req.user._id as string, // Use MongoDB _id
    action,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Conversation request responded successfully",
    data: result,
  });
});

const getAllConversations = catchAsync(async (req, res) => {
  const result = await ConversationService.getAllConversationService(
    req.user._id as string // Use MongoDB _id
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All conversations retrieved successfully",
    data: result,
  });
});

const getConversationById = catchAsync(async (req, res) => {
  const { conversationId } = req.params;

  const result = await ConversationService.getConversationByIdService({
    conversationId,
    userId: req.user._id as string, // Use MongoDB _id
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Conversation retrieved successfully",
    data: result,
  });
});

export const conversationController = {
  createDMConversation,
  respondToConversationRequest,
  getAllConversations,
  getConversationById,
};
