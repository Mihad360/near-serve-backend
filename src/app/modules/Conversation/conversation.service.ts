// backend/src/modules/Conversation/conversation.service.ts

import HttpStatus from "http-status";
import { Types } from "mongoose";
import { JwtPayload } from "../../interface/global";
import { ConversationModel } from "./conversation.model";
import AppError from "../../erros/AppError";
import QueryBuilder from "../../../builder/QueryBuilder";

// ─── Get All My Conversations ─────────────────────────────────────────────────
const getMyConversations = async (
  user: JwtPayload,
  query: Record<string, unknown>,
) => {
  const userId = new Types.ObjectId(user.user);
  const userRole = user.role;

  // both customer and provider are stored as userId in conversation
  // so filter is straightforward for both roles
  const filter: Record<string, unknown> = {
    isDeleted: false,
    ...(userRole === "customer"
      ? { customerId: userId }
      : { providerId: userId }),
  };

  const conversationQuery = new QueryBuilder(
    ConversationModel.find(filter)
      .populate("customerId", "name profileImage phone")
      .populate("providerId", "name profileImage phone")
      .populate("jobId", "title category status scheduledAt"),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await conversationQuery.countTotal();
  const result = await conversationQuery.modelQuery;

  return { meta, result };
};

// ─── Get Single Conversation ──────────────────────────────────────────────────
const getConversationById = async (
  user: JwtPayload,
  conversationId: string,
) => {
  const userId = new Types.ObjectId(user.user);

  const conversation = await ConversationModel.findById(conversationId)
    .populate("customerId", "name avatar phone")
    .populate("providerId", "name avatar phone")
    .populate("jobId", "title category status budget scheduledAt location");

  if (!conversation || conversation.isDeleted) {
    throw new AppError(HttpStatus.NOT_FOUND, "Conversation not found");
  }

  // verify requester is part of this conversation
  const isParticipant =
    conversation.customerId._id.equals(userId) ||
    conversation.providerId._id.equals(userId);

  if (!isParticipant) {
    throw new AppError(
      HttpStatus.FORBIDDEN,
      "You are not part of this conversation",
    );
  }

  return conversation;
};

// ─── Delete Conversation (soft delete) ───────────────────────────────────────
const deleteConversation = async (user: JwtPayload, conversationId: string) => {
  const userId = new Types.ObjectId(user.user);

  const conversation = await ConversationModel.findById(conversationId);

  if (!conversation || conversation.isDeleted) {
    throw new AppError(HttpStatus.NOT_FOUND, "Conversation not found");
  }

  // verify requester is part of this conversation
  const isParticipant =
    conversation.customerId.equals(userId) ||
    conversation.providerId.equals(userId);

  if (!isParticipant) {
    throw new AppError(
      HttpStatus.FORBIDDEN,
      "You are not part of this conversation",
    );
  }

  await ConversationModel.findByIdAndUpdate(
    conversationId,
    { $set: { isDeleted: true, isActive: false } },
    { new: true },
  );

  return null;
};

export const conversationServices = {
  getMyConversations,
  getConversationById,
  deleteConversation,
};
