// backend/src/modules/Conversation/conversation.controller.ts

import HttpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { conversationServices } from "./conversation.service";
import { JwtPayload } from "../../interface/global";

const getMyConversations = catchAsync(async (req, res) => {
  const result = await conversationServices.getMyConversations(
    req.user as JwtPayload,
    req.query,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Conversations retrieved successfully",
    meta: result.meta,
    data: result.result,
  });
});

const getConversationById = catchAsync(async (req, res) => {
  const result = await conversationServices.getConversationById(
    req.user as JwtPayload,
    req.params.id,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Conversation retrieved successfully",
    data: result,
  });
});

const deleteConversation = catchAsync(async (req, res) => {
  await conversationServices.deleteConversation(
    req.user as JwtPayload,
    req.params.id,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Conversation deleted successfully",
    data: null,
  });
});

export const conversationControllers = {
  getMyConversations,
  getConversationById,
  deleteConversation,
};
