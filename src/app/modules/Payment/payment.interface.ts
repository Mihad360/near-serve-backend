import { Types } from "mongoose";

// ─── Payment Interface ───────────────────────────────────────────────────────
export interface IPayment {
  _id?: Types.ObjectId;
  jobId: Types.ObjectId; // ref to Job
  customerId: Types.ObjectId; // ref to User
  providerId: Types.ObjectId; // ref to Provider
  stripePaymentIntentId: string;
  amount: number;
  currency?: string;
  status?: "pending" | "authorized" | "captured" | "refunded" | "failed";
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: Date;
  capturedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  isDeleted?: boolean;
}
