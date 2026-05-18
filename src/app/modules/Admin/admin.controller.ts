// backend/src/modules/Admin/admin.controller.ts

import HttpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { adminServices } from "./admin.service";

const toggleProviderApproval = catchAsync(async (req, res) => {
  const result = await adminServices.toggleProviderApproval(
    req.params.providerId,
    req.body.type,
    req.body.reason,
  );
  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Provider rejected",
    data: result,
  });
});

const getAllProviders = catchAsync(async (req, res) => {
  const result = await adminServices.getAllProviders(req.query);
  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Providers retrieved successfully",
    meta: result.meta,
    data: result.result,
  });
});

const getProviderDetails = catchAsync(async (req, res) => {
  const result = await adminServices.getProviderDetails(req.params.providerId);
  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Provider details retrieved",
    data: result,
  });
});

const getUserDetails = catchAsync(async (req, res) => {
  const result = await adminServices.getUserDetails(req.params.userId);
  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "User details retrieved",
    data: result,
  });
});

const toggleUserBlockStatus = catchAsync(async (req, res) => {
  const result = await adminServices.toggleUserBlockStatus(
    req.params.userId,
    req.body.type,
    req.body.reason,
  );
  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "User blocked successfully",
    data: result,
  });
});

// ─── Jobs ─────────────────────────────────────────────────────────────────────
const getAllJobs = catchAsync(async (req, res) => {
  const result = await adminServices.getAllJobs(req.query);
  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Jobs retrieved successfully",
    meta: result.meta,
    data: result.result,
  });
});

const getJobDetails = catchAsync(async (req, res) => {
  const result = await adminServices.getJobDetails(req.params.jobId);
  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Job details retrieved",
    data: result,
  });
});

const adminCancelJob = catchAsync(async (req, res) => {
  const result = await adminServices.adminCancelJob(
    req.params.jobId,
    req.body.reason,
  );
  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Job cancelled by admin",
    data: result,
  });
});

// ─── Disputes ─────────────────────────────────────────────────────────────────
const getAllDisputes = catchAsync(async (req, res) => {
  const result = await adminServices.getAllDisputes(req.query);
  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Disputes retrieved successfully",
    meta: result.meta,
    data: result.result,
  });
});

const getDisputeDetails = catchAsync(async (req, res) => {
  const result = await adminServices.getDisputeDetails(req.params.jobId);
  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Dispute details retrieved",
    data: result,
  });
});

const resolveDispute = catchAsync(async (req, res) => {
  const result = await adminServices.resolveDispute(
    req.params.jobId,
    req.body.resolution,
    req.body.refundPercent,
    req.body.adminNote,
  );
  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Dispute resolved successfully",
    data: result,
  });
});

// ─── Reviews ──────────────────────────────────────────────────────────────────
const getAllReviews = catchAsync(async (req, res) => {
  const result = await adminServices.getAllReviews(req.query);
  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Reviews retrieved successfully",
    meta: result.meta,
    data: result.result,
  });
});

const deleteReview = catchAsync(async (req, res) => {
  await adminServices.deleteReview(req.params.reviewId);
  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Review deleted successfully",
    data: null,
  });
});

export const adminControllers = {
  toggleProviderApproval,
  getAllProviders,
  getProviderDetails,
  getUserDetails,
  toggleUserBlockStatus,
  getAllJobs,
  getJobDetails,
  adminCancelJob,
  getAllDisputes,
  getDisputeDetails,
  resolveDispute,
  getAllReviews,
  deleteReview,
};
