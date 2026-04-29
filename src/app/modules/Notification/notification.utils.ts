import HttpStatus from "http-status";
import { ClientSession, Types } from "mongoose";
import { UserModel } from "../../modules/User/user.model";
import { INotification } from "../../modules/Notification/notification.interface";
import { connectedUsers, io } from "../../utils/socket";
import { sendPushNotifications } from "../../utils/firebase/notification";
import AppError from "../../erros/AppError";
import { NotificationModel } from "./notification.model";

interface SendNotificationPayload {
  recipientId: Types.ObjectId | string;
  senderId?: Types.ObjectId | string;
  type: INotification["type"];
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

// ─── Map each type to its specific socket event name ─────────────────────────
const getSocketEvent = (type: INotification["type"]): string => {
  const eventMap: Record<INotification["type"], string> = {
    new_bid: "new_bid",
    bid_accepted: "bid_accepted",
    bid_rejected: "bid_rejected",
    bid_withdrawn: "bid_withdrawn",
    job_status_changed: "job_status_changed",
    new_job_posted: "new_job_posted",
    payment_captured: "payment_captured",
    payment_refunded: "payment_refunded",
    provider_approved: "provider_approved",
    message: "new_message",
    user_registration: "user_registration",
  };

  return eventMap[type] || "notification";
};

export const sendNotification = async (payload: SendNotificationPayload) => {
  const { recipientId, senderId, type, title, message, data } = payload;

  const recipientIdStr = recipientId.toString();

  // ─── 1. Save to DB ────────────────────────────────────────────────────────
  await createNotification({
    recipient: new Types.ObjectId(recipientIdStr),
    sender: senderId ? new Types.ObjectId(senderId.toString()) : undefined,
    type,
    title,
    message,
    data: data || {},
  });

  // ─── 2. Socket.io — emit specific event ──────────────────────────────────
  const connectedUser = connectedUsers.get(recipientIdStr);
  if (connectedUser && io) {
    const socketEvent = getSocketEvent(type);

    io.to(connectedUser.socketID).emit(socketEvent, {
      type,
      title,
      message,
      data: data || {},
    });
  }

  // ─── 3. Firebase — push notification ─────────────────────────────────────
  try {
    const user = await UserModel.findById(recipientIdStr).select("fcmToken");
    if (user?.fcmToken && user.fcmToken.length > 0) {
      await sendPushNotifications(user.fcmToken, title, message);
    }
  } catch (err) {
    console.log("Push notification failed:", err);
  }
};

export const createNotification = async (
  payload: INotification,
  session?: ClientSession, // Typing session with Mongoose ClientSession
) => {
  try {
    if (!payload) {
      throw new AppError(HttpStatus.NOT_FOUND, "Response not found");
    }

    // Create notification with session to ensure it's part of the transaction
    const sendNot = await NotificationModel.create([payload], { session });

    if (!sendNot) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        "Notification creation failed",
      );
    }

    return sendNot[0];
  } catch (error) {
    console.error("Error creating notification:", error);
    throw new Error("Notification creation failed");
  }
};
