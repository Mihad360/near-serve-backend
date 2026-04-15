import { Types } from "mongoose";

// ─── Provider Interface ──────────────────────────────────────────────────────
export interface IProvider {
  _id?: Types.ObjectId;
  userId: Types.ObjectId; // ref to User
  categories: string[];
  bio?: string;
  description?: string;
  trustScore?: number;
  completionRate?: number;
  avgResponseTime?: number;
  portfolio?: string[];
  subscriptionTier?: "free" | "pro";
  stripeSubscriptionId?: string;
  totalEarnings?: number;
  totalJobs?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
