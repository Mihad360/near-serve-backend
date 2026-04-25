// message.interface.ts

import { Types } from "mongoose";

export interface IAttachment {
  url: string;
  type: "image" | "audio" | "document";
  name: string;
  size?: number;
}

export interface IMessage {
  _id?: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content?: string;
  messageType: "text" | "image" | "audio" | "document" | "location";
  attachments?: IAttachment[]; // CHANGED — array now
  isRead?: boolean;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
