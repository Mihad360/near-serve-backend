// backend/src/modules/Review/review.controller.ts

import HttpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { reviewServices } from "./review.service";
import { JwtPayload } from "../../interface/global";

const createReview = catchAsync(async (req, res) => {
  const result = await reviewServices.createReview(
    req.user as JwtPayload,
    req.body,
  );

  sendResponse(res, {
    statusCode: HttpStatus.CREATED,
    success: true,
    message: "Review submitted successfully",
    data: result,
  });
});

const getProviderReviews = catchAsync(async (req, res) => {
  const result = await reviewServices.getProviderReviews(
    req.params.providerId,
    req.query,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Reviews retrieved successfully",
    meta: result.meta,
    data: result.result,
  });
});

const getMyReviews = catchAsync(async (req, res) => {
  const result = await reviewServices.getMyReviews(
    req.user as JwtPayload,
    req.query,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Your reviews retrieved successfully",
    meta: result.meta,
    data: result.result,
  });
});

const replyToReview = catchAsync(async (req, res) => {
  const result = await reviewServices.replyToReview(
    req.user as JwtPayload,
    req.params.reviewId,
    req.body.reply,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Reply added successfully",
    data: result,
  });
});

const deleteReview = catchAsync(async (req, res) => {
  await reviewServices.deleteReview(req.params.reviewId);

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Review deleted successfully",
    data: null,
  });
});

export const reviewControllers = {
  createReview,
  getProviderReviews,
  getMyReviews,
  replyToReview,
  deleteReview,
};
