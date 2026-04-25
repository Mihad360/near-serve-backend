// message.model.ts

import { model, Schema } from "mongoose";
import { IAttachment, IMessage } from "./message.interface";

const attachmentSchema = new Schema<IAttachment>(
  {
    url: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["image", "audio", "document"],
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      default: null,
    },
  },
  { _id: false },
);

const messageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      trim: true,
      default: null,
    },
    messageType: {
      type: String,
      enum: ["text", "image", "audio", "document", "location"],
      default: "text",
    },
    attachments: {
      type: [attachmentSchema], // CHANGED — array
      default: [],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export const MessageModel = model<IMessage>("Message", messageSchema);
