// notification.service.ts

import { Types } from "mongoose";
import { NotificationModel } from "./notification.model";
import { INotification } from "./notification.interface";
import { JwtPayload } from "../../interface/global";
import QueryBuilder from "../../../builder/QueryBuilder";

export const createNotification = async (payload: Partial<INotification>) => {
  const notification = await NotificationModel.create(payload);
  return notification;
};

const getMyNotifications = async (
  user: JwtPayload,
  query: Record<string, unknown>,
) => {
  const recipientId = new Types.ObjectId(user.user);

  const notifQuery = new QueryBuilder(
    NotificationModel.find({ recipient: recipientId }),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await notifQuery.countTotal();
  const result = await notifQuery.modelQuery;

  return { meta, result };
};

const markAsRead = async (user: JwtPayload, notificationId: string) => {
  const notification = await NotificationModel.findOneAndUpdate(
    {
      _id: new Types.ObjectId(notificationId),
      recipient: new Types.ObjectId(user.user),
    },
    { $set: { isRead: true } },
    { new: true },
  );
  return notification;
};

const markAllAsRead = async (user: JwtPayload) => {
  await NotificationModel.updateMany(
    { recipient: new Types.ObjectId(user.user), isRead: false },
    { $set: { isRead: true } },
  );
  return null;
};

const getUnreadCount = async (user: JwtPayload) => {
  const count = await NotificationModel.countDocuments({
    recipient: new Types.ObjectId(user.user),
    isRead: false,
  });
  return { count };
};

export const notificationServices = {
  createNotification,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};
