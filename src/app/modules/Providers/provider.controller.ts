// backend/src/modules/provider/provider.controller.ts

import HttpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { providerServices } from "./provider.service";
import { JwtPayload } from "../../interface/global";

const setupProfile = catchAsync(async (req, res) => {
  const result = await providerServices.setupProfile(
    req.user as JwtPayload,
    req.body,
  );

  sendResponse(res, {
    statusCode: HttpStatus.CREATED,
    success: true,
    message: "Provider profile created successfully",
    data: result,
  });
});

const getProviderById = catchAsync(async (req, res) => {
  const result = await providerServices.getProviderById(req.params.id);

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Provider retrieved successfully",
    data: result,
  });
});

const getAllProviders = catchAsync(async (req, res) => {
  const result = await providerServices.getAllProviders(req.query);

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Providers retrieved successfully",
    meta: result.meta,
    data: result.result,
  });
});

const searchNearbyProviders = catchAsync(async (req, res) => {
  const { latitude, longitude, radius, category } = req.query;

  const result = await providerServices.searchNearbyProviders(
    parseFloat(latitude as string),
    parseFloat(longitude as string),
    parseFloat(radius as string) || 10,
    category as string,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Nearby providers retrieved successfully",
    data: result,
  });
});

const approveProvider = catchAsync(async (req, res) => {
  const result = await providerServices.approveProvider(req.params.id);

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Provider approved successfully",
    data: result,
  });
});

export const providerControllers = {
  setupProfile,
  getProviderById,
  getAllProviders,
  searchNearbyProviders,
  approveProvider,
};
