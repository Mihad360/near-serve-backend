import HttpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { adminServices } from "./admin.service";

const approveProvider = catchAsync(async (req, res) => {
  const result = await adminServices.approveProvider(req.params.providerId);

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Provider approved successfully",
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

export const adminControllers = {
  approveProvider,
  getAllProviders,
};
