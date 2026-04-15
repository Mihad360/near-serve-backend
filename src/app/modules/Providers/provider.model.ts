import { model, Schema } from "mongoose";
import { IProvider } from "./provider.interface";

const providerSchema = new Schema<IProvider>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one provider profile per user
    },
    categories: {
      type: [String],
      required: true,
      default: [],
    },
    bio: {
      type: String,
      trim: true,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    trustScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    completionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    avgResponseTime: {
      type: Number,
      default: 0, // in minutes
    },
    portfolio: {
      type: [String], // Cloudinary URLs
      default: [],
    },
    subscriptionTier: {
      type: String,
      enum: ["free", "pro"],
      default: "free",
    },
    stripeSubscriptionId: {
      type: String,
      default: null,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
    totalJobs: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// ─── Model ───────────────────────────────────────────────────────────────────
export const ProviderModel = model<IProvider>("Provider", providerSchema);
