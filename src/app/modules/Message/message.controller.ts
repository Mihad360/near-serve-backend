// backend/src/modules/Message/message.controller.ts

import HttpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { messageServices } from "./message.service";
import { JwtPayload } from "../../interface/global";

const getMessages = catchAsync(async (req, res) => {
  const result = await messageServices.getMessages(
    req.user as JwtPayload,
    req.params.conversationId,
    req.query,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Messages retrieved successfully",
    meta: result.meta,
    data: result.result,
  });
});

const sendMessage = catchAsync(async (req, res) => {
  const result = await messageServices.sendMessage(
    req.user as JwtPayload,
    req.params.conversationId,
    req.body,
  );

  sendResponse(res, {
    statusCode: HttpStatus.CREATED,
    success: true,
    message: "Message sent successfully",
    data: result,
  });
});

const sendAttachment = catchAsync(async (req, res) => {
  // upload.array gives req.files as array
  const files = req.files as Express.Multer.File[];

  const result = await messageServices.sendAttachment(
    req.user as JwtPayload,
    req.params.conversationId,
    files,
    req.body.content,
  );

  sendResponse(res, {
    statusCode: HttpStatus.CREATED,
    success: true,
    message: "Attachment sent successfully",
    data: result,
  });
});

const deleteMessage = catchAsync(async (req, res) => {
  await messageServices.deleteMessage(
    req.user as JwtPayload,
    req.params.messageId,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Message deleted successfully",
    data: null,
  });
});

export const messageControllers = {
  getMessages,
  sendMessage,
  sendAttachment,
  deleteMessage,
};
