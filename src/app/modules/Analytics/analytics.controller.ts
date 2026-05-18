// backend/src/modules/Analytics/analytics.controller.ts

import HttpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { analyticsServices } from "./analytics.service";
import { JwtPayload } from "../../interface/global";

const getProviderAnalytics = catchAsync(async (req, res) => {
  const result = await analyticsServices.getProviderAnalytics(
    req.user as JwtPayload,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Analytics retrieved successfully",
    data: result,
  });
});

const getAdminAnalytics = catchAsync(async (req, res) => {
  const result = await analyticsServices.getAdminAnalytics();

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Platform analytics retrieved successfully",
    data: result,
  });
});

export const analyticsControllers = {
  getProviderAnalytics,
  getAdminAnalytics,
};
