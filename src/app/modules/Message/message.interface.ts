import { Types } from "mongoose";

// ─── Message Interface ───────────────────────────────────────────────────────
export interface IMessage {
  _id?: Types.ObjectId;
  conversationId: Types.ObjectId; // ref to Conversation
  senderId: Types.ObjectId; // ref to User
  content: string;
  messageType?: "text" | "image" | "location";
  attachmentUrl?: string;
  isRead?: boolean;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
