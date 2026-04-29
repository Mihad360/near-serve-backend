import { Types } from "mongoose";

export interface INotification {
  _id?: Types.ObjectId;
  sender?: Types.ObjectId | null;
  recipient: Types.ObjectId;
  type:
    | "user_registration"
    | "new_bid"
    | "bid_accepted"
    | "bid_rejected"
    | "bid_withdrawn"
    | "job_status_changed"
    | "new_job_posted"
    | "payment_captured"
    | "payment_refunded"
    | "provider_approved"
    | "message";
  title: string;
  message: string;
  data?: Record<string, unknown>; // extra info like jobId, bidId
  isRead?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SendNotificationPayload {
  recipientId: Types.ObjectId | string;
  senderId?: Types.ObjectId | string;
  type: INotification["type"];
  title: string;
  message: string;
  data?: Record<string, unknown>;
}
