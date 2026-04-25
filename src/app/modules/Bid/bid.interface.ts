import { Types } from "mongoose";

// ─── Bid Interface ───────────────────────────────────────────────────────────
export interface IBid {
  _id?: Types.ObjectId;
  jobId: Types.ObjectId; // ref to Job
  providerId: Types.ObjectId; // ref to Provider
  price: number;
  etaMinutes: number;
  // bid.interface.ts — add this field
  responseTimeMinutes?: number;
  message?: string;
  status?: "pending" | "accepted" | "rejected" | "withdrawn";
  isRead?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
