// backend/src/modules/Job/job.controller.ts

import HttpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { jobServices } from "./job.service";
import { JwtPayload } from "../../interface/global";

const createJob = catchAsync(async (req, res) => {
  const result = await jobServices.createJob(req.user as JwtPayload, req.body);

  sendResponse(res, {
    statusCode: HttpStatus.CREATED,
    success: true,
    message: "Job posted successfully",
    data: result,
  });
});

const getMyJobs = catchAsync(async (req, res) => {
  const result = await jobServices.getMyJobs(req.user as JwtPayload, req.query);

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Jobs retrieved successfully",
    meta: result.meta,
    data: result.result,
  });
});

const getJobFeed = catchAsync(async (req, res) => {
  const result = await jobServices.getJobFeed(
    req.user as JwtPayload,
    req.query,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Job feed retrieved successfully",
    meta: result.meta,
    data: result.result,
  });
});

const getJobById = catchAsync(async (req, res) => {
  const result = await jobServices.getJobById(req.params.jobId);

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Job retrieved successfully",
    data: result,
  });
});

const updateJobStatus = catchAsync(async (req, res) => {
  const result = await jobServices.updateJobStatus(
    req.user as JwtPayload,
    req.params.jobId,
    req.body.status,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Job status updated successfully",
    data: result,
  });
});

const cancelJob = catchAsync(async (req, res) => {
  const result = await jobServices.cancelJob(
    req.user as JwtPayload,
    req.params.jobId,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Job cancelled successfully",
    data: result,
  });
});

const getAllJobs = catchAsync(async (req, res) => {
  const result = await jobServices.getAllJobs(req.query);

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "All jobs retrieved successfully",
    meta: result.meta,
    data: result.result,
  });
});

export const jobControllers = {
  createJob,
  getMyJobs,
  getJobFeed,
  getJobById,
  updateJobStatus,
  cancelJob,
  getAllJobs,
};
