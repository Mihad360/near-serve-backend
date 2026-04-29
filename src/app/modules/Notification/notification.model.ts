// notification.model.ts

import { model, Schema } from "mongoose";
import { INotification } from "./notification.interface";

const notificationSchema = new Schema<INotification>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "user_registration",
        "new_bid",
        "bid_accepted",
        "bid_rejected",
        "bid_withdrawn",
        "job_status_changed",
        "new_job_posted",
        "payment_captured",
        "payment_refunded",
        "provider_approved",
        "message",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export const NotificationModel = model<INotification>(
  "Notification",
  notificationSchema,
);
