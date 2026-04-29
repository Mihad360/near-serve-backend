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
import { UserModel } from "../User/user.model";
import { sendNotification } from "../Notification/notification.utils";

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

// ─── Helper — get the other participant in conversation ───────────────────────
const getOtherParticipant = (
  conversation: { customerId: Types.ObjectId; providerId: Types.ObjectId },
  senderId: Types.ObjectId,
): Types.ObjectId => {
  return conversation.customerId.equals(senderId)
    ? conversation.providerId
    : conversation.customerId;
};

// ─── Get Messages ─────────────────────────────────────────────────────────────
const getMessages = async (
  user: JwtPayload,
  conversationId: string,
  query: Record<string, unknown>,
) => {
  const userId = new Types.ObjectId(user.user);
  const convId = new Types.ObjectId(conversationId);

  await verifyParticipant(convId, userId);

  // mark as read first
  await MessageModel.updateMany(
    {
      conversationId: convId,
      senderId: { $ne: userId },
      isRead: false,
    },
    { $set: { isRead: true } },
  );

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

  const conversation = await verifyParticipant(convId, userId);

  if (!payload.content || !payload.content.trim()) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Message content is required");
  }

  const message = await MessageModel.create({
    conversationId: convId,
    senderId: userId,
    content: payload.content.trim(),
    messageType: "text",
  });

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

  // ─── Get sender name for notification ─────────────────────────────────────
  const sender = await UserModel.findById(userId).select("name");
  const recipientId = getOtherParticipant(conversation, userId);

  // ─── Notify other participant — socket + firebase ─────────────────────────
  try {
    await sendNotification({
      recipientId,
      senderId: userId,
      type: "message",
      title: `New message from ${sender?.name || "Someone"}`,
      message: payload.content.trim(),
      data: {
        conversationId: convId.toString(),
        messageId: message._id?.toString(),
        messageType: "text",
      },
    });
  } catch (err) {
    console.log("Message notification failed:", err);
  }

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

  const conversation = await verifyParticipant(convId, userId);

  if (!files || !files.length) {
    throw new AppError(HttpStatus.BAD_REQUEST, "At least one file is required");
  }

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
    "audio/x-wav",
    "audio/wave",
    "audio/ogg",
    "audio/webm",
    "audio/m4a",
    "audio/x-m4a",
  ];

  const hasAudio = files.some((f) => f.mimetype.startsWith("audio/"));
  if (hasAudio && files.length > 1) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Audio must be sent alone — one audio file per message",
    );
  }

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

  const messageType: IMessage["messageType"] = allImages
    ? "image"
    : allAudio
      ? "audio"
      : "document";

  const uploadResults = await Promise.all(
    files.map((file) =>
      sendFileToCloudinary(file.buffer, file.originalname, file.mimetype),
    ),
  );

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

  const message = await MessageModel.create({
    conversationId: convId,
    senderId: userId,
    content: content?.trim() || null,
    messageType,
    attachments,
  });

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

  // ─── Get sender name for notification ─────────────────────────────────────
  const sender = await UserModel.findById(userId).select("name");
  const recipientId = getOtherParticipant(conversation, userId);

  // ─── Notify other participant — socket + firebase ─────────────────────────
  try {
    const notifMessage = content?.trim() || lastMessagePreview;

    await sendNotification({
      recipientId,
      senderId: userId,
      type: "message",
      title: `New message from ${sender?.name || "Someone"}`,
      message: notifMessage,
      data: {
        conversationId: convId.toString(),
        messageId: message._id?.toString(),
        messageType,
      },
    });
  } catch (err) {
    console.log("Attachment notification failed:", err);
  }

  return message;
};

// ─── Delete Message (soft delete) ────────────────────────────────────────────
const deleteMessage = async (user: JwtPayload, messageId: string) => {
  const userId = new Types.ObjectId(user.user);

  const message = await MessageModel.findById(messageId);

  if (!message || message.isDeleted) {
    throw new AppError(HttpStatus.NOT_FOUND, "Message not found");
  }

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
