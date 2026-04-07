import { model, Schema } from "mongoose";
import { IJob } from "./job.interface";
import { ILocation } from "../User/user.interface";
import { IPayment } from "../Payment/payment.interface";

const paymentSchema = new Schema<IPayment>(
  {
    stripePaymentIntentId: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "usd",
    },
    status: {
      type: String,
      enum: ["pending", "authorized", "captured", "refunded", "failed"],
      default: "pending",
    },
  },
  { _id: false },
);

// ─── Location Sub-schema ─────────────────────────────────────────────────────
const locationSchema = new Schema<ILocation>(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    },
  },
  { _id: false },
);

// ─── Job Schema ──────────────────────────────────────────────────────────────
const jobSchema = new Schema<IJob>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    selectedProvider: {
      type: Schema.Types.ObjectId,
      ref: "Provider",
      default: null,
    },
    selectedBid: {
      type: Schema.Types.ObjectId,
      ref: "Bid",
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    location: {
      type: locationSchema,
      required: true,
    },
    budget: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        "open",
        "bidding",
        "booked",
        "in_progress",
        "completed",
        "disputed",
        "cancelled",
      ],
      default: "open",
    },
    payment: {
      type: paymentSchema,
      default: () => ({}),
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const JobModel = model<IJob>("Job", jobSchema);
