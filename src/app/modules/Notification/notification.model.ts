import { model, Schema } from "mongoose";
import { INotification } from "./notification.interface";

const notificationSchema = new Schema<INotification>(
  {
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true }, // Admin or recipient reference
    recipient: { type: Schema.Types.ObjectId, ref: "User", default: null }, // Admin or recipient reference
    type: {
      type: String,
      enum: ["user_registration", "user_login", "user_join", "message"],
    },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const NotificationModel = model<INotification>(
  "Notification",
  notificationSchema,
);
