// backend/src/modules/Bid/bid.service.ts

import HttpStatus from "http-status";
import { Types } from "mongoose";
import { JwtPayload } from "../../interface/global";
import { BidModel } from "./bid.model";
import AppError from "../../erros/AppError";
import QueryBuilder from "../../../builder/QueryBuilder";
import { IBid } from "./bid.interface";
import { JobModel } from "../Jobs/job.model";
import { ProviderModel } from "../Providers/provider.model";
import { UserModel } from "../User/user.model";
import { ConversationModel } from "../Conversation/conversation.model";
import { sendNotification } from "../Notification/notification.utils";

const submitBid = async (
  user: JwtPayload,
  jobId: string,
  payload: Partial<IBid>,
) => {
  const userId = new Types.ObjectId(user.user);

  const provider = await ProviderModel.findOne({ userId });
  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider profile not found");
  }

  const providerUser = await UserModel.findById(userId);
  if (!providerUser?.isApproved) {
    throw new AppError(
      HttpStatus.FORBIDDEN,
      "Your account is not approved yet",
    );
  }

  const job = await JobModel.findById(jobId);
  if (!job) {
    throw new AppError(HttpStatus.NOT_FOUND, "Job not found");
  }

  if (!["open", "bidding"].includes(job.status as string)) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "This job is no longer accepting bids",
    );
  }

  if (!provider.categories.includes(job.category)) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "This job does not match your service categories",
    );
  }

  const alreadyBid = await BidModel.findOne({
    jobId: new Types.ObjectId(jobId),
    providerId: provider._id,
  });
  if (alreadyBid) {
    throw new AppError(HttpStatus.CONFLICT, "You have already bid on this job");
  }

  // ─── Calculate response time ───────────────────────────────────────────────
  const responseTimeMinutes = Math.round(
    (Date.now() - new Date(job.createdAt as Date).getTime()) / 60000,
  );

  // create bid with response time
  const bid = await BidModel.create({
    ...payload,
    jobId: new Types.ObjectId(jobId),
    providerId: provider._id,
    status: "pending",
    responseTimeMinutes,
  });

  // ─── Update provider avgResponseTime ──────────────────────────────────────
  const allProviderBids = await BidModel.find({
    providerId: provider._id,
    status: { $ne: "withdrawn" },
    responseTimeMinutes: { $ne: null },
  });

  const totalTime = allProviderBids.reduce(
    (sum, b) => sum + (b.responseTimeMinutes || 0),
    0,
  );

  const avgResponseTime = Math.round(totalTime / allProviderBids.length);

  await ProviderModel.findByIdAndUpdate(
    provider._id,
    { $set: { avgResponseTime } },
    { new: true },
  );

  // if first bid — update job status to bidding
  if (job.status === "open") {
    await JobModel.findByIdAndUpdate(
      jobId,
      { $set: { status: "bidding" } },
      { new: true },
    );
  }

  await sendNotification({
    recipientId: job.customerId,
    senderId: userId,
    type: "new_bid",
    title: "New Bid Received",
    message: `A provider submitted a bid of $${payload.price} on your job "${job.title}"`,
    data: {
      jobId: job._id.toString(),
      bidId: bid._id.toString(),
    },
  });

  return bid;
};

// ─── Get Bids For a Job (customer sees all bids on their job) ─────────────────
const getBidsForJob = async (user: JwtPayload, jobId: string) => {
  const customerId = new Types.ObjectId(user.user);

  // verify this job belongs to this customer
  const job = await JobModel.findById(jobId);
  if (!job) {
    throw new AppError(HttpStatus.NOT_FOUND, "Job not found");
  }

  if (!job.customerId.equals(customerId)) {
    throw new AppError(HttpStatus.FORBIDDEN, "This is not your job");
  }

  const bids = await BidModel.find({ jobId: job._id })
    .populate({
      path: "providerId",
      select:
        "categories trustScore completionRate totalJobs avgResponseTime portfolio",
      populate: {
        path: "userId",
        select: "name avatar phone",
      },
    })
    .sort({ createdAt: -1 });

  return bids;
};

// ─── Accept Bid (customer) ────────────────────────────────────────────────────
const acceptBid = async (user: JwtPayload, bidId: string) => {
  const customerId = new Types.ObjectId(user.user);

  // get bid
  const bid = await BidModel.findById(bidId);
  if (!bid) {
    throw new AppError(HttpStatus.NOT_FOUND, "Bid not found");
  }

  // get job and verify ownership
  const job = await JobModel.findById(bid.jobId);
  if (!job) {
    throw new AppError(HttpStatus.NOT_FOUND, "Job not found");
  }

  if (!job.customerId.equals(customerId)) {
    throw new AppError(HttpStatus.FORBIDDEN, "This is not your job");
  }

  // job must be open or bidding to accept
  if (!["open", "bidding"].includes(job.status as string)) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "This job is no longer accepting bid acceptance",
    );
  }

  // bid must be pending
  if (bid.status !== "pending") {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "This bid is no longer available",
    );
  }

  // accept this bid
  await BidModel.findByIdAndUpdate(
    bidId,
    { $set: { status: "accepted" } },
    { new: true },
  );

  // reject all other bids on this job
  await BidModel.updateMany(
    {
      jobId: bid.jobId,
      _id: { $ne: new Types.ObjectId(bidId) },
      status: "pending",
    },
    { $set: { status: "rejected" } },
  );

  // update job — set selectedBid, selectedProvider, status booked
  const updatedJob = await JobModel.findByIdAndUpdate(
    bid.jobId,
    {
      $set: {
        selectedBid: bid._id,
        selectedProvider: bid.providerId,
        status: "booked",
      },
    },
    { new: true },
  );

  // get provider's userId from bid
  const providerDoc = await ProviderModel.findById(bid.providerId);
  if (!providerDoc) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider not found");
  }

  // create conversation using both userIds
  const conversation = await ConversationModel.findOneAndUpdate(
    {
      jobId: bid.jobId,
      customerId,
      providerId: providerDoc.userId, // userId not Provider _id
    },
    {
      $setOnInsert: {
        jobId: bid.jobId,
        customerId,
        providerId: providerDoc.userId, // userId not Provider _id
        isActive: true,
        isDeleted: false,
      },
    },
    { upsert: true, new: true },
  );

  if (!conversation) {
    throw new AppError(HttpStatus.BAD_REQUEST, "conversation create failed");
  }

  // notify accepted provider
  await sendNotification({
    recipientId: providerDoc.userId,
    senderId: customerId,
    type: "bid_accepted",
    title: "Your Bid Was Accepted!",
    message: `Your bid has been accepted. Get ready for the job.`,
    data: {
      jobId: job._id.toString(),
      bidId: bid._id.toString(),
    },
  });

  // notify all rejected providers
  const rejectedBids = await BidModel.find({
    jobId: bid.jobId,
    status: "rejected",
  });

  for (const rejectedBid of rejectedBids) {
    const rejectedProvider = await ProviderModel.findById(
      rejectedBid.providerId,
    );
    if (rejectedProvider) {
      await sendNotification({
        recipientId: rejectedProvider.userId,
        type: "bid_rejected",
        title: "Bid Not Selected",
        message: `Another provider was selected for this job.`,
        data: { jobId: job._id.toString() },
      });
    }
  }

  return updatedJob;
};

// ─── Withdraw Bid (provider) ──────────────────────────────────────────────────
const withdrawBid = async (user: JwtPayload, bidId: string) => {
  const userId = new Types.ObjectId(user.user);

  const provider = await ProviderModel.findOne({ userId });
  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider profile not found");
  }

  const bid = await BidModel.findById(bidId);
  if (!bid) {
    throw new AppError(HttpStatus.NOT_FOUND, "Bid not found");
  }

  // must be their own bid
  if (!bid.providerId.equals(provider._id as Types.ObjectId)) {
    throw new AppError(HttpStatus.FORBIDDEN, "This is not your bid");
  }

  // can only withdraw pending bids
  if (bid.status !== "pending") {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "You can only withdraw a pending bid",
    );
  }

  const updated = await BidModel.findByIdAndUpdate(
    bidId,
    { $set: { status: "withdrawn" } },
    { new: true },
  );

  return updated;
};

// ─── Get My Bids (provider) ───────────────────────────────────────────────────
const getMyBids = async (user: JwtPayload, query: Record<string, unknown>) => {
  const userId = new Types.ObjectId(user.user);

  const provider = await ProviderModel.findOne({ userId });
  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider profile not found");
  }

  const bidQuery = new QueryBuilder(
    BidModel.find({ providerId: provider._id }).populate(
      "jobId",
      "title category budget status scheduledAt location",
    ),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await bidQuery.countTotal();
  const result = await bidQuery.modelQuery;

  return { meta, result };
};

// ─── Mark Bid As Read (customer) ──────────────────────────────────────────────
const markBidAsRead = async (user: JwtPayload, bidId: string) => {
  const customerId = new Types.ObjectId(user.user);

  const bid = await BidModel.findById(bidId).populate("jobId");
  if (!bid) {
    throw new AppError(HttpStatus.NOT_FOUND, "Bid not found");
  }

  const job = await JobModel.findById(bid.jobId);
  if (!job?.customerId.equals(customerId)) {
    throw new AppError(HttpStatus.FORBIDDEN, "This is not your job");
  }

  const updated = await BidModel.findByIdAndUpdate(
    bidId,
    { $set: { isRead: true } },
    { new: true },
  );

  return updated;
};

export const bidServices = {
  submitBid,
  getBidsForJob,
  acceptBid,
  withdrawBid,
  getMyBids,
  markBidAsRead,
};
