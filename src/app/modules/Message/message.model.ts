import { model, Schema } from "mongoose";
import { IMessage } from "./message.interface";

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
      required: true,
      trim: true,
    },
    messageType: {
      type: String,
      enum: ["text", "image", "location"],
      default: "text",
    },
    attachmentUrl: {
      type: String, // Cloudinary URL for image messages
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false, // soft delete
    },
  },
  {
    timestamps: true,
  },
);

export const MessageModel = model<IMessage>("Message", messageSchema);
