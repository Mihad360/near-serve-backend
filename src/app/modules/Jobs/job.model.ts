// backend/src/modules/Job/job.model.ts

import { model, Schema } from "mongoose";
import { IJob } from "./job.interface";
import { ILocation } from "../User/user.interface";

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

const jobSchema = new Schema<IJob>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
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

// ─── Indexes ──────────────────────────────────────────────────────────────────
jobSchema.index({ location: "2dsphere" });

export const JobModel = model<IJob>("Job", jobSchema);
