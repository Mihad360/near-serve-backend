/* eslint-disable @typescript-eslint/no-explicit-any */
// backend/src/modules/Admin/admin.service.ts

import HttpStatus from "http-status";
import { Types } from "mongoose";
import AppError from "../../erros/AppError";
import { ProviderModel } from "../Providers/provider.model";
import { UserModel } from "../User/user.model";
import { JobModel } from "../Jobs/job.model";
import { BidModel } from "../Bid/bid.model";
import { ReviewModel } from "../Review/review.model";
import { PaymentModel } from "../Payment/payment.model";
import { ConversationModel } from "../Conversation/conversation.model";
import { MessageModel } from "../Message/message.model";
import QueryBuilder from "../../../builder/QueryBuilder";
import { sendNotification } from "../Notification/notification.utils";

// ─── PROVIDER MANAGEMENT ──────────────────────────────────────────────────────

type ToggleTypeBlockUnblock = "block" | "unblock";
type ToggleTypeApproveReject = "approve" | "reject";

const toggleProviderApproval = async (
  providerId: string,
  type: ToggleTypeApproveReject,
  reason?: string,
) => {
  const provider = await ProviderModel.findById(providerId);

  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider not found");
  }

  // BLOCK PROVIDER
  if (type === "reject") {
    const updatedUser = await UserModel.findByIdAndUpdate(
      provider.userId,
      { isApproved: false },
      { new: true },
    ).select(
      "-fcmToken -password -otp -expiresAt -isVerified -passwordChangedAt",
    );

    if (!updatedUser) {
      throw new AppError(HttpStatus.NOT_FOUND, "Provider rejection failed");
    }

    await sendNotification({
      recipientId: updatedUser._id,
      type: "provider_blocked",
      title: "Account Not Approved",
      message: `Your provider account was not approved. Reason: ${reason}`,
      data: { reason },
    });

    return updatedUser;
  }

  // UNBLOCK / APPROVE PROVIDER
  if (type === "approve") {
    const updatedUser = await UserModel.findByIdAndUpdate(
      provider.userId,
      { isApproved: true },
      { new: true },
    ).select(
      "-fcmToken -password -otp -expiresAt -isVerified -passwordChangedAt",
    );

    if (!updatedUser) {
      throw new AppError(HttpStatus.NOT_FOUND, "Provider approve failed");
    }

    await sendNotification({
      recipientId: updatedUser._id,
      type: "provider_approved",
      title: "Account Approved!",
      message:
        "Your provider account has been approved. You can now receive jobs.",
      data: {},
    });

    return updatedUser;
  }
};

const getAllProviders = async (query: Record<string, unknown>) => {
  const providerQuery = new QueryBuilder(
    ProviderModel.find().populate(
      "userId",
      "name email avatar phone isApproved isAvailable createdAt",
    ),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await providerQuery.countTotal();
  const result = await providerQuery.modelQuery;

  return { meta, result };
};

const getProviderDetails = async (providerId: string) => {
  const provider = await ProviderModel.findById(providerId).populate(
    "userId",
    "name email avatar phone isApproved isAvailable createdAt",
  );

  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider not found");
  }

  // get their recent jobs
  const recentJobs = await JobModel.find({
    selectedProvider: new Types.ObjectId(providerId),
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("title category status budget createdAt");

  // get their reviews
  const reviews = await ReviewModel.find({
    providerId: new Types.ObjectId(providerId),
    isDeleted: false,
  })
    .populate("customerId", "name avatar")
    .sort({ createdAt: -1 })
    .limit(5);

  return { provider, recentJobs, reviews };
};

// ─── USER MANAGEMENT ──────────────────────────────────────────────────────────

const getUserDetails = async (userId: string) => {
  const user = await UserModel.findById(userId).select(
    "-password -otp -expiresAt -passwordChangedAt -fcmToken",
  );

  if (!user) {
    throw new AppError(HttpStatus.NOT_FOUND, "User not found");
  }

  // get their jobs
  const jobs = await JobModel.find({
    customerId: new Types.ObjectId(userId),
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("title category status budget createdAt");

  // get their payments
  const payments = await PaymentModel.find({
    customerId: new Types.ObjectId(userId),
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("amount status capturedAt refundedAt");

  return { user, recentJobs: jobs, recentPayments: payments };
};

const toggleUserBlockStatus = async (
  userId: string,
  type: ToggleTypeBlockUnblock,
  reason?: string,
) => {
  const user = await UserModel.findById(userId);

  if (!user) {
    throw new AppError(HttpStatus.NOT_FOUND, "User not found");
  }

  if (user.role === "admin") {
    throw new AppError(HttpStatus.FORBIDDEN, "Cannot block an admin");
  }

  // BLOCK USER
  if (type === "block") {
    const updated = await UserModel.findByIdAndUpdate(
      userId,
      { isDeleted: true },
      { new: true },
    ).select("-password -otp -expiresAt");

    await sendNotification({
      recipientId: new Types.ObjectId(userId),
      type: "user_blocked",
      title: "Account Blocked",
      message: reason || "Your account has been blocked by admin.",
      data: { reason },
    });

    return updated;
  }

  // UNBLOCK USER
  if (type === "unblock") {
    const updated = await UserModel.findByIdAndUpdate(
      userId,
      { isDeleted: false },
      { new: true },
    ).select("-password -otp -expiresAt");

    await sendNotification({
      recipientId: new Types.ObjectId(userId),
      type: "user_unblocked",
      title: "Account Unblocked",
      message: "Your account has been restored. You can now use NearServe.",
      data: {},
    });

    return updated;
  }
};

// ─── JOB MANAGEMENT ───────────────────────────────────────────────────────────

const getAllJobs = async (query: Record<string, unknown>) => {
  const jobQuery = new QueryBuilder(
    JobModel.find()
      .populate("customerId", "name email avatar")
      .populate("selectedProvider", "userId trustScore"),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await jobQuery.countTotal();
  const result = await jobQuery.modelQuery;

  return { meta, result };
};

const getJobDetails = async (jobId: string) => {
  const job = await JobModel.findById(jobId)
    .populate("customerId", "name email avatar phone")
    .populate({
      path: "selectedProvider",
      populate: { path: "userId", select: "name email avatar phone" },
    })
    .populate("selectedBid", "price etaMinutes message");

  if (!job) {
    throw new AppError(HttpStatus.NOT_FOUND, "Job not found");
  }

  const bids = await BidModel.find({ jobId: new Types.ObjectId(jobId) })
    .populate({
      path: "providerId",
      select: "trustScore categories",
      populate: { path: "userId", select: "name avatar" },
    })
    .sort({ createdAt: -1 });

  const payment = await PaymentModel.findOne({
    jobId: new Types.ObjectId(jobId),
    isDeleted: false,
  });

  return { job, bids, payment };
};

const adminCancelJob = async (jobId: string, reason: string) => {
  const job = await JobModel.findById(jobId);
  if (!job) {
    throw new AppError(HttpStatus.NOT_FOUND, "Job not found");
  }

  if (["completed", "cancelled"].includes(job.status as string)) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Cannot cancel a completed or already cancelled job",
    );
  }

  const updated = await JobModel.findByIdAndUpdate(
    jobId,
    { $set: { status: "cancelled" } },
    { new: true },
  );

  // notify customer
  await sendNotification({
    recipientId: job.customerId,
    type: "job_status_changed",
    title: "Job Cancelled by Admin",
    message: `Your job "${job.title}" was cancelled. Reason: ${reason}`,
    data: { jobId, reason, status: "cancelled" },
  });

  // notify provider if assigned
  if (job.selectedProvider) {
    const provider = await ProviderModel.findById(job.selectedProvider);
    if (provider) {
      await sendNotification({
        recipientId: provider.userId,
        type: "job_status_changed",
        title: "Job Cancelled by Admin",
        message: `A job was cancelled by admin. Reason: ${reason}`,
        data: { jobId, reason, status: "cancelled" },
      });
    }
  }

  return updated;
};

// ─── DISPUTE MANAGEMENT ───────────────────────────────────────────────────────

const getAllDisputes = async (query: Record<string, unknown>) => {
  const disputeQuery = new QueryBuilder(
    JobModel.find({ status: "disputed" })
      .populate("customerId", "name email avatar phone")
      .populate({
        path: "selectedProvider",
        populate: { path: "userId", select: "name email avatar phone" },
      })
      .populate("selectedBid", "price message"),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await disputeQuery.countTotal();
  const result = await disputeQuery.modelQuery;

  return { meta, result };
};

const getDisputeDetails = async (jobId: string) => {
  const job = await JobModel.findById(jobId)
    .populate("customerId", "name email avatar phone")
    .populate({
      path: "selectedProvider",
      populate: { path: "userId", select: "name email avatar phone" },
    })
    .populate("selectedBid", "price etaMinutes message");

  if (!job || job.status !== "disputed") {
    throw new AppError(HttpStatus.NOT_FOUND, "Disputed job not found");
  }

  // get payment
  const payment = await PaymentModel.findOne({
    jobId: new Types.ObjectId(jobId),
    isDeleted: false,
  });

  // get conversation and last 20 messages as evidence
  const conversation = await ConversationModel.findOne({
    jobId: new Types.ObjectId(jobId),
  });

  let messages: any[] = [];
  if (conversation) {
    messages = await MessageModel.find({
      conversationId: conversation._id,
      isDeleted: false,
    })
      .populate("senderId", "name role")
      .sort({ createdAt: -1 })
      .limit(20);
  }

  return { job, payment, messages };
};

const resolveDispute = async (
  jobId: string,
  resolution: "refund_customer" | "release_to_provider" | "partial_refund",
  refundPercent?: number,
  adminNote?: string,
) => {
  const job = await JobModel.findById(jobId);
  if (!job || job.status !== "disputed") {
    throw new AppError(HttpStatus.NOT_FOUND, "Disputed job not found");
  }

  const payment = await PaymentModel.findOne({
    jobId: new Types.ObjectId(jobId),
    status: { $in: ["authorized", "captured"] },
    isDeleted: false,
  });

  if (!payment) {
    throw new AppError(HttpStatus.NOT_FOUND, "Payment not found for this job");
  }

  const provider = await ProviderModel.findById(job.selectedProvider);

  if (resolution === "release_to_provider") {
    // mark job completed — provider wins dispute
    await JobModel.findByIdAndUpdate(
      jobId,
      { $set: { status: "completed" } },
      { new: true },
    );

    // notify both
    await sendNotification({
      recipientId: job.customerId,
      type: "job_status_changed",
      title: "Dispute Resolved",
      message: `Admin reviewed your dispute and decided in favour of the provider. ${adminNote || ""}`,
      data: { jobId, resolution },
    });

    if (provider) {
      await sendNotification({
        recipientId: provider.userId,
        type: "job_status_changed",
        title: "Dispute Resolved in Your Favour",
        message: `Admin reviewed the dispute and decided in your favour. Payment will be released. ${adminNote || ""}`,
        data: { jobId, resolution },
      });
    }

    return {
      resolution,
      message: "Dispute resolved — payment released to provider",
    };
  }

  if (resolution === "refund_customer") {
    // full refund to customer — provider loses
    await JobModel.findByIdAndUpdate(
      jobId,
      { $set: { status: "cancelled" } },
      { new: true },
    );

    await sendNotification({
      recipientId: job.customerId,
      type: "payment_refunded",
      title: "Dispute Resolved — Full Refund",
      message: `Admin reviewed your dispute and issued a full refund. ${adminNote || ""}`,
      data: { jobId, resolution },
    });

    if (provider) {
      await sendNotification({
        recipientId: provider.userId,
        type: "payment_refunded",
        title: "Dispute Resolved",
        message: `Admin reviewed the dispute and issued a refund to the customer. ${adminNote || ""}`,
        data: { jobId, resolution },
      });
    }

    return {
      resolution,
      message: "Dispute resolved — full refund issued to customer",
    };
  }

  if (resolution === "partial_refund") {
    if (!refundPercent || refundPercent <= 0 || refundPercent >= 100) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        "refundPercent must be between 1 and 99 for partial refund",
      );
    }

    const refundAmount = parseFloat(
      ((payment.amount * refundPercent) / 100).toFixed(2),
    );

    await JobModel.findByIdAndUpdate(
      jobId,
      { $set: { status: "cancelled" } },
      { new: true },
    );

    await sendNotification({
      recipientId: job.customerId,
      type: "payment_refunded",
      title: "Dispute Resolved — Partial Refund",
      message: `Admin issued a ${refundPercent}% refund ($${refundAmount}). ${adminNote || ""}`,
      data: { jobId, resolution, refundAmount, refundPercent },
    });

    if (provider) {
      await sendNotification({
        recipientId: provider.userId,
        type: "payment_refunded",
        title: "Dispute Resolved — Partial Refund",
        message: `Admin issued a partial refund to the customer. ${adminNote || ""}`,
        data: { jobId, resolution, refundAmount, refundPercent },
      });
    }

    return {
      resolution,
      refundAmount,
      refundPercent,
      message: `Dispute resolved — ${refundPercent}% refund ($${refundAmount}) issued`,
    };
  }
};

// ─── REVIEW MANAGEMENT ────────────────────────────────────────────────────────

const getAllReviews = async (query: Record<string, unknown>) => {
  const reviewQuery = new QueryBuilder(
    ReviewModel.find({ isDeleted: false })
      .populate("customerId", "name avatar")
      .populate("providerId", "userId trustScore"),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await reviewQuery.countTotal();
  const result = await reviewQuery.modelQuery;

  return { meta, result };
};

const deleteReview = async (reviewId: string) => {
  const review = await ReviewModel.findById(reviewId);
  if (!review || review.isDeleted) {
    throw new AppError(HttpStatus.NOT_FOUND, "Review not found");
  }

  await ReviewModel.findByIdAndUpdate(
    reviewId,
    { $set: { isDeleted: true } },
    { new: true },
  );

  return null;
};

export const adminServices = {
  // providers
  toggleProviderApproval,
  getAllProviders,
  getProviderDetails,
  // users
  getUserDetails,
  toggleUserBlockStatus,
  // jobs
  getAllJobs,
  getJobDetails,
  adminCancelJob,
  // disputes
  getAllDisputes,
  getDisputeDetails,
  resolveDispute,
  // reviews
  getAllReviews,
  deleteReview,
};
