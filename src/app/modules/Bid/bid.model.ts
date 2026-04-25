import { model, Schema } from "mongoose";
import { IBid } from "./bid.interface";

const bidSchema = new Schema<IBid>(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    etaMinutes: {
      type: Number,
      required: true,
      min: 0,
    },
    // bid.model.ts — add this field
    responseTimeMinutes: {
      type: Number,
      default: null,
    },
    message: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "withdrawn"],
      default: "pending",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

export const BidModel = model<IBid>("Bid", bidSchema);
