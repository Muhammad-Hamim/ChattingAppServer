import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import httpStatus from "http-status";
import { MessageService } from "./message.service";

const getConversationMessages = catchAsync(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user?._id || req.user?.id;

  const result = await MessageService.getConversationMessagesService({
    conversationId,
    userId: userId as string,
    query: req.query,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Messages retrieved successfully",
    data: result,
  });
});

const sendMessage = catchAsync(async (req, res) => {
  const { conversationId } = req.params;
  const { content, type = "text", replyTo } = req.body;
  const senderId = req.user?._id || req.user?.id;

  const result = await MessageService.sendMessageService({
    conversationId,
    senderId: senderId as string,
    content,
    type,
    replyTo,
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Message sent successfully",
    data: result,
  });
});

// const editMessage = catchAsync(async (req, res) => {
//   const { messageId } = req.params;
//   const { content } = req.body;
//   const userId = req.user?._id || req.user?.id;

//   const result = await MessageService.editMessageService({
//     messageId,
//     userId: userId as string,
//     newContent: content,
//   });

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "Message edited successfully",
//     data: result,
//   });
// });

// const deleteMessageForEveryone = catchAsync(async (req, res) => {
//   const { messageId } = req.params;
//   const userId = req.user?._id || req.user?.id;

//   const result = await MessageService.deleteMessageForEveryoneService({
//     messageId,
//     userId: userId as string,
//   });

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "Message deleted for everyone successfully",
//     data: result,
//   });
// });

// const deleteMessageForMe = catchAsync(async (req, res) => {
//   const { messageId } = req.params;
//   const userId = req.user?._id || req.user?.id;

//   const result = await MessageService.deleteMessageForMeService({
//     messageId,
//     userId: userId as string,
//   });

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "Message deleted for you successfully",
//     data: result,
//   });
// });

export const MessageController = {
  getConversationMessages,
  sendMessage,
//   editMessage,
//   deleteMessageForEveryone,
//   deleteMessageForMe,
};
