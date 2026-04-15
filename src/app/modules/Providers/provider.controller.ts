// backend/src/modules/provider/provider.controller.ts

import HttpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { providerServices } from "./provider.service";

const getProviderById = catchAsync(async (req, res) => {
  const result = await providerServices.getProviderById(req.params.providerId);

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Provider retrieved successfully",
    data: result,
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

export const providerControllers = {
  getProviderById,
  searchNearbyProviders,
};
