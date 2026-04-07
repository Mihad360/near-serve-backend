import HttpStatus from "http-status";
import catchAsync from "../../../utils/catchAsync";
import sendResponse from "../../../utils/sendResponse";
import { aboutServices } from "./About.service";
import { JwtPayload } from "../../../interface/global";

const createAbout = catchAsync(async (req, res) => {
  const result = await aboutServices.createAbout(
    req.body,
    req.user as JwtPayload,
  );

  sendResponse(res, {
    statusCode: HttpStatus.CREATED,
    success: true,
    message: "About created successfully",
    data: result,
  });
});

const getAllAbout = catchAsync(async (req, res) => {
  const result = await aboutServices.getAllAbout();

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "About retrieved successfully",
    data: result,
  });
});

const updateAbout = catchAsync(async (req, res) => {
  const result = await aboutServices.updateAbout(
    req.body,
    req.user as JwtPayload,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "About updated successfully",
    data: result,
  });
});

export const aboutControllers = {
  createAbout,
  getAllAbout,
  updateAbout,
};
