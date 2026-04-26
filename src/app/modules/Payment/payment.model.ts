import { model, Schema } from "mongoose";
import { IPayment } from "./payment.interface";

const paymentSchema = new Schema<IPayment>(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
    },
    stripePaymentIntentId: {
      type: String,
    },
    stripeSessionId: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
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
    // payment.model.ts — add these fields inside schema

    commissionRate: {
      type: Number,
      default: 0,
    },
    commissionAmount: {
      type: Number,
      default: 0,
    },
    providerPayout: {
      type: Number,
      default: 0,
    },
    refundAmount: {
      type: Number,
      default: null,
    },
    refundReason: {
      type: String,
      default: null,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
    capturedAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// ─── Model ───────────────────────────────────────────────────────────────────
export const PaymentModel = model<IPayment>("Payment", paymentSchema);
