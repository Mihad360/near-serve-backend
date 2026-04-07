import { Types } from "mongoose";

// ─── Conversation Interface ──────────────────────────────────────────────────
export interface IConversation {
  _id?: Types.ObjectId;
  jobId: Types.ObjectId; // ref to Job
  customerId: Types.ObjectId; // ref to User
  providerId: Types.ObjectId; // ref to Provider
  lastMessage?: string;
  lastMessageAt?: Date;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  isDeleted?: boolean;
}
