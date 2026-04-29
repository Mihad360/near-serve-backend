import { Types } from "mongoose";

// ─── Payment Interface ───────────────────────────────────────────────────────
export interface IPayment {
  _id?: Types.ObjectId;
  jobId: Types.ObjectId; // ref to Job
  customerId: Types.ObjectId; // ref to User
  providerId: Types.ObjectId; // ref to Provider
  stripePaymentIntentId: string;
  stripeSessionId?: string;
  amount: number;
  currency?: string;
  status?: "pending" | "authorized" | "captured" | "refunded" | "failed";
  commissionRate?: number; // NEW — percentage e.g. 10
  commissionAmount?: number; // NEW — admin earnings e.g. 10
  providerPayout?: number; // NEW — provider gets e.g. 90
  stripeProcessingFee?: number; // what Stripe took
  actualCommission?: number;
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: Date;
  capturedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  isDeleted?: boolean;
}
