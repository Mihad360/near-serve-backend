// backend/src/modules/Review/review.service.ts

import HttpStatus from "http-status";
import { Types } from "mongoose";
import { JwtPayload } from "../../interface/global";
import { ReviewModel } from "./review.model";
import AppError from "../../erros/AppError";
import QueryBuilder from "../../../builder/QueryBuilder";
import { IReview } from "./review.interface";
import { ProviderModel } from "../Providers/provider.model";
import { JobModel } from "../Jobs/job.model";

// ─── Helper — recalculate provider trust score after review ───────────────────
const recalculateTrustScore = async (providerId: Types.ObjectId) => {
  const reviews = await ReviewModel.find({
    providerId,
    isDeleted: false,
  });

  const provider = await ProviderModel.findById(providerId);
  if (!provider) return;

  // average rating from all reviews
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  // normalize rating to 0-100
  const ratingScore = (avgRating / 5) * 100;

  // weights as we planned
  // review rating 40%
  // completion rate 25%
  // avg response time 15% — lower is better, max 60 min
  // dispute rate 10% — lower is better (not tracked yet, default 100)
  // profile completeness 10%

  const completionScore = provider.completionRate || 0;

  const responseScore =
    provider.avgResponseTime && provider.avgResponseTime > 0
      ? Math.max(0, 100 - (provider.avgResponseTime / 60) * 100)
      : 100;

  const profileScore =
    [
      provider.bio,
      provider.categories?.length > 0,
      provider.portfolio && provider.portfolio?.length > 0,
    ].filter(Boolean).length *
    (100 / 3);

  const trustScore = Math.round(
    ratingScore * 0.4 +
      completionScore * 0.25 +
      responseScore * 0.15 +
      100 * 0.1 + // dispute rate — default 100 until dispute module built
      profileScore * 0.1,
  );

  await ProviderModel.findByIdAndUpdate(
    providerId,
    { $set: { trustScore: Math.min(100, Math.max(0, trustScore)) } },
    { new: true },
  );
};

// ─── Create Review (customer) ─────────────────────────────────────────────────
const createReview = async (user: JwtPayload, payload: Partial<IReview>) => {
  const customerId = new Types.ObjectId(user.user);

  // job must exist
  const job = await JobModel.findById(payload.jobId);
  if (!job) {
    throw new AppError(HttpStatus.NOT_FOUND, "Job not found");
  }

  // job must belong to this customer
  if (!job.customerId.equals(customerId)) {
    throw new AppError(HttpStatus.FORBIDDEN, "This is not your job");
  }

  // job must be completed
  if (job.status !== "completed") {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "You can only review a completed job",
    );
  }

  // one review per job
  const alreadyReviewed = await ReviewModel.findOne({
    jobId: payload.jobId,
  });
  if (alreadyReviewed) {
    throw new AppError(
      HttpStatus.CONFLICT,
      "You have already reviewed this job",
    );
  }

  // get provider from job
  const provider = await ProviderModel.findById(job.selectedProvider);
  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider not found");
  }

  const review = await ReviewModel.create({
    jobId: payload.jobId,
    customerId,
    providerId: provider._id,
    rating: payload.rating,
    comment: payload.comment || null,
  });

  // recalculate trust score after new review
  await recalculateTrustScore(provider._id as Types.ObjectId);

  return review;
};

// ─── Get Reviews For a Provider (public) ─────────────────────────────────────
const getProviderReviews = async (
  providerId: string,
  query: Record<string, unknown>,
) => {
  const reviewQuery = new QueryBuilder(
    ReviewModel.find({
      providerId: new Types.ObjectId(providerId),
      isDeleted: false,
    }).populate("customerId", "name profileImage"),
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

// ─── Get My Reviews (customer) ────────────────────────────────────────────────
const getMyReviews = async (
  user: JwtPayload,
  query: Record<string, unknown>,
) => {
  const customerId = new Types.ObjectId(user.user);

  const reviewQuery = new QueryBuilder(
    ReviewModel.find({
      customerId,
      isDeleted: false,
    })
      .populate("jobId", "title category scheduledAt")
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

// ─── Provider Reply to Review ─────────────────────────────────────────────────
const replyToReview = async (
  user: JwtPayload,
  reviewId: string,
  reply: string,
) => {
  const userId = new Types.ObjectId(user.user);

  const review = await ReviewModel.findById(reviewId);
  if (!review || review.isDeleted) {
    throw new AppError(HttpStatus.NOT_FOUND, "Review not found");
  }

  // verify this review is for this provider
  const provider = await ProviderModel.findOne({ userId });
  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider profile not found");
  }

  if (!review.providerId.equals(provider._id as Types.ObjectId)) {
    throw new AppError(
      HttpStatus.FORBIDDEN,
      "This review is not for your profile",
    );
  }

  // can only reply once
  if (review.providerReply) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "You have already replied to this review",
    );
  }

  const updated = await ReviewModel.findByIdAndUpdate(
    reviewId,
    { $set: { providerReply: reply.trim() } },
    { new: true },
  ).populate("customerId", "name profileImage");

  return updated;
};

// ─── Delete Review (admin only) ───────────────────────────────────────────────
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

  // recalculate trust score after deletion
  await recalculateTrustScore(review.providerId);

  return null;
};

export const reviewServices = {
  createReview,
  getProviderReviews,
  getMyReviews,
  replyToReview,
  deleteReview,
};
