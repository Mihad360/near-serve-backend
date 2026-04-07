import { Types } from "mongoose";

export interface INotification {
  sender: Types.ObjectId;
  recipient?: Types.ObjectId; // The admin's user ID or a role
  type: "user_registration" | "user_login" | "user_join" | "message"; // Type of notification
  message: string; // Message content
  isRead?: boolean; // To mark the notification as read or unread
  createdAt?: Date; // Timestamp of when the notification was created
}
