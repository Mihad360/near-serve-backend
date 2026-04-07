import HttpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { userServices } from "./user.service";
import { JwtPayload } from "../../interface/global";

const getMe = catchAsync(async (req, res) => {
  const result = await userServices.getMe(req.user as JwtPayload);

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Password reset OTP sent to email",
    data: result,
  });
});

const getUsers = catchAsync(async (req, res) => {
  const result = await userServices.getUsers(req.query);

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Password reset OTP sent to email",
    meta: result.meta,
    data: result.result,
  });
});

const editProfile = catchAsync(async (req, res) => {
  const user = req.user as JwtPayload;
  const id = user.user as string;
  const file = req.file as Express.Multer.File;
  const result = await userServices.editProfile(id, file, req.body);

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});

export const userControllers = {
  getMe,
  getUsers,
  editProfile,
};
