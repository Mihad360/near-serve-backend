// backend/src/modules/Message/message.service.ts

import HttpStatus from "http-status";
import { Types } from "mongoose";
import { JwtPayload } from "../../interface/global";
import { MessageModel } from "./message.model";
import { ConversationModel } from "../Conversation/conversation.model";
import AppError from "../../erros/AppError";
import QueryBuilder from "../../../builder/QueryBuilder";
import { sendFileToCloudinary } from "../../utils/sendImageToCloudinary";
import { IMessage } from "./message.interface";

// ─── Helper — verify sender is part of conversation ───────────────────────────
const verifyParticipant = async (
  conversationId: Types.ObjectId,
  userId: Types.ObjectId,
) => {
  const conversation = await ConversationModel.findById(conversationId);

  if (!conversation || conversation.isDeleted) {
    throw new AppError(HttpStatus.NOT_FOUND, "Conversation not found");
  }

  const isParticipant =
    conversation.customerId.equals(userId) ||
    conversation.providerId.equals(userId);

  if (!isParticipant) {
    throw new AppError(
      HttpStatus.FORBIDDEN,
      "You are not part of this conversation",
    );
  }

  return conversation;
};

// ─── Get Messages ─────────────────────────────────────────────────────────────
const getMessages = async (
  user: JwtPayload,
  conversationId: string,
  query: Record<string, unknown>,
) => {
  const userId = new Types.ObjectId(user.user);
  const convId = new Types.ObjectId(conversationId);

  // verify participant
  await verifyParticipant(convId, userId);

  const messageQuery = new QueryBuilder(
    MessageModel.find({
      conversationId: convId,
      isDeleted: false,
    }).populate("senderId", "name profileImage role"),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await messageQuery.countTotal();
  const result = await messageQuery.modelQuery;

  // mark all unread messages as read
  await MessageModel.updateMany(
    {
      conversationId: convId,
      senderId: { $ne: userId },
      isRead: false,
    },
    { $set: { isRead: true } },
  );

  return { meta, result };
};

// ─── Send Text Message ────────────────────────────────────────────────────────
const sendMessage = async (
  user: JwtPayload,
  conversationId: string,
  payload: Partial<IMessage>,
) => {
  const userId = new Types.ObjectId(user.user);
  const convId = new Types.ObjectId(conversationId);

  // verify participant
  await verifyParticipant(convId, userId);

  // must have content for text message
  if (!payload.content || !payload.content.trim()) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Message content is required");
  }

  const message = await MessageModel.create({
    conversationId: convId,
    senderId: userId,
    content: payload.content.trim(),
    messageType: "text",
  });

  // update conversation lastMessage and lastMessageAt
  await ConversationModel.findByIdAndUpdate(
    convId,
    {
      $set: {
        lastMessage: payload.content.trim(),
        lastMessageAt: new Date(),
      },
    },
    { new: true },
  );

  return message;
};

// ─── Send Attachment ──────────────────────────────────────────────────────────
const sendAttachment = async (
  user: JwtPayload,
  conversationId: string,
  files: Express.Multer.File[],
  content?: string,
) => {
  const userId = new Types.ObjectId(user.user);
  const convId = new Types.ObjectId(conversationId);

  await verifyParticipant(convId, userId);

  if (!files || !files.length) {
    throw new AppError(HttpStatus.BAD_REQUEST, "At least one file is required");
  }

  // ─── Validate all files first before uploading anything ───────────────────
  const allowedImageTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  const allowedDocTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const allowedAudioTypes = [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav", // ✅ add this
    "audio/wave",
    "audio/ogg",
    "audio/webm",
    "audio/m4a",
    "audio/x-m4a",
  ];

  // audio — strictly one file only
  const hasAudio = files.some((f) => f.mimetype.startsWith("audio/"));
  if (hasAudio && files.length > 1) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Audio must be sent alone — one audio file per message",
    );
  }

  // validate each file mimetype
  for (const file of files) {
    const isImage = allowedImageTypes.includes(file.mimetype);
    const isDoc = allowedDocTypes.includes(file.mimetype);
    const isAudio = allowedAudioTypes.includes(file.mimetype);

    if (!isImage && !isDoc && !isAudio) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        `Unsupported file type: ${file.mimetype}. Allowed: images, audio, pdf, word documents`,
      );
    }
  }

  // mixed types not allowed — cannot send image and document together
  const allImages = files.every((f) => f.mimetype.startsWith("image/"));
  const allDocs = files.every((f) => allowedDocTypes.includes(f.mimetype));
  const allAudio = files.every((f) => f.mimetype.startsWith("audio/"));

  if (!allImages && !allDocs && !allAudio) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Cannot mix file types. Send images together, documents together, or one audio at a time",
    );
  }

  if (allDocs && files.length > 3) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Maximum 3 documents per message",
    );
  }

  // ─── Determine messageType ─────────────────────────────────────────────────
  const messageType: IMessage["messageType"] = allImages
    ? "image"
    : allAudio
      ? "audio"
      : "document";

  // ─── Upload all files to Cloudinary in parallel ───────────────────────────
  const uploadResults = await Promise.all(
    files.map((file) =>
      sendFileToCloudinary(file.buffer, file.originalname, file.mimetype),
    ),
  );

  // ─── Build attachments array ───────────────────────────────────────────────
  const attachments = uploadResults.map((result, index) => ({
    url: result.secure_url,
    type:
      messageType === "image"
        ? "image"
        : messageType === "audio"
          ? "audio"
          : ("document" as "image" | "audio" | "document"),
    name: files[index].originalname,
    size: files[index].size,
  }));

  // ─── Create message ────────────────────────────────────────────────────────
  const message = await MessageModel.create({
    conversationId: convId,
    senderId: userId,
    content: content?.trim() || null,
    messageType,
    attachments,
  });

  // ─── Update conversation preview ───────────────────────────────────────────
  const countText = files.length > 1 ? ` (${files.length})` : "";
  const lastMessagePreview =
    messageType === "image"
      ? `📷 Image${countText}`
      : messageType === "audio"
        ? "🎵 Audio"
        : `📄 Document${countText}`;

  await ConversationModel.findByIdAndUpdate(
    convId,
    {
      $set: {
        lastMessage: content?.trim() || lastMessagePreview,
        lastMessageAt: new Date(),
      },
    },
    { new: true },
  );

  return message;
};

// ─── Delete Message (soft delete) ────────────────────────────────────────────
const deleteMessage = async (user: JwtPayload, messageId: string) => {
  const userId = new Types.ObjectId(user.user);

  const message = await MessageModel.findById(messageId);

  if (!message || message.isDeleted) {
    throw new AppError(HttpStatus.NOT_FOUND, "Message not found");
  }

  // only sender can delete their own message
  if (!message.senderId.equals(userId)) {
    throw new AppError(
      HttpStatus.FORBIDDEN,
      "You can only delete your own messages",
    );
  }

  await MessageModel.findByIdAndUpdate(
    messageId,
    { $set: { isDeleted: true } },
    { new: true },
  );

  return null;
};

export const messageServices = {
  getMessages,
  sendMessage,
  sendAttachment,
  deleteMessage,
};
