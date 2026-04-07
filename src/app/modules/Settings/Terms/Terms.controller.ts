import HttpStatus from "http-status";
import sendResponse from "../../../utils/sendResponse";
import { JwtPayload } from "../../../interface/global";
import { termsServices } from "./Terms.service";
import catchAsync from "../../../utils/catchAsync";

const createTerms = catchAsync(async (req, res) => {
  const result = await termsServices.createTerms(
    req.body,
    req.user as JwtPayload,
  );

  sendResponse(res, {
    statusCode: HttpStatus.CREATED,
    success: true,
    message: "Terms created successfully",
    data: result,
  });
});

const getAllTerms = catchAsync(async (req, res) => {
  const result = await termsServices.getAllTerms();

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Terms retrieved successfully",
    data: result,
  });
});

const updateTerms = catchAsync(async (req, res) => {
  const result = await termsServices.updateTerms(
    req.body,
    req.user as JwtPayload,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Terms updated successfully",
    data: result,
  });
});

export const termsControllers = {
  createTerms,
  getAllTerms,
  updateTerms,
};
