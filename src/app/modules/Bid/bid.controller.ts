// backend/src/modules/Bid/bid.controller.ts

import HttpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { bidServices } from "./bid.service";
import { JwtPayload } from "../../interface/global";

const submitBid = catchAsync(async (req, res) => {
  const result = await bidServices.submitBid(
    req.user as JwtPayload,
    req.params.jobId,
    req.body,
  );

  sendResponse(res, {
    statusCode: HttpStatus.CREATED,
    success: true,
    message: "Bid submitted successfully",
    data: result,
  });
});

const getBidsForJob = catchAsync(async (req, res) => {
  const result = await bidServices.getBidsForJob(
    req.user as JwtPayload,
    req.params.jobId,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Bids retrieved successfully",
    data: result,
  });
});

const acceptBid = catchAsync(async (req, res) => {
  const result = await bidServices.acceptBid(
    req.user as JwtPayload,
    req.params.bidId,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Bid accepted successfully",
    data: result,
  });
});

const withdrawBid = catchAsync(async (req, res) => {
  const result = await bidServices.withdrawBid(
    req.user as JwtPayload,
    req.params.bidId,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Bid withdrawn successfully",
    data: result,
  });
});

const getMyBids = catchAsync(async (req, res) => {
  const result = await bidServices.getMyBids(req.user as JwtPayload, req.query);

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Your bids retrieved successfully",
    meta: result.meta,
    data: result.result,
  });
});

const markBidAsRead = catchAsync(async (req, res) => {
  const result = await bidServices.markBidAsRead(
    req.user as JwtPayload,
    req.params.bidId,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Bid marked as read",
    data: result,
  });
});

export const bidControllers = {
  submitBid,
  getBidsForJob,
  acceptBid,
  withdrawBid,
  getMyBids,
  markBidAsRead,
};
