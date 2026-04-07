import { Types } from "mongoose";

// ─── Provider Interface ──────────────────────────────────────────────────────
export interface IProvider {
  _id?: Types.ObjectId;
  userId: Types.ObjectId; // ref to User
  categories: string[];
  bio?: string;
  trustScore?: number;
  completionRate?: number;
  avgResponseTime?: number;
  portfolio?: string[];
  subscriptionTier?: "free" | "pro";
  stripeSubscriptionId?: string;
  isApproved?: boolean;
  isAvailable?: boolean;
  totalEarnings?: number;
  totalJobs?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
