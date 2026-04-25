// backend/src/modules/Payment/payment.controller.ts

import HttpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { paymentServices } from "./payment.service";
import { JwtPayload } from "../../interface/global";

const createPaymentIntent = catchAsync(async (req, res) => {
  const result = await paymentServices.createPaymentIntent(
    req.user as JwtPayload,
    req.body.jobId,
  );

  sendResponse(res, {
    statusCode: HttpStatus.CREATED,
    success: true,
    message: "Payment intent created successfully",
    data: result,
  });
});

const capturePayment = catchAsync(async (req, res) => {
  const result = await paymentServices.capturePayment(
    req.user as JwtPayload,
    req.body.jobId,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Payment captured successfully",
    data: result,
  });
});

const refundPayment = catchAsync(async (req, res) => {
  const result = await paymentServices.refundPayment(
    req.body.jobId,
    req.body.refundAmount,
    req.body.refundReason,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Refund issued successfully",
    data: result,
  });
});

const getPaymentHistory = catchAsync(async (req, res) => {
  const result = await paymentServices.getPaymentHistory(
    req.user as JwtPayload,
    req.query,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Payment history retrieved successfully",
    meta: result.meta,
    data: result.result,
  });
});

export const paymentControllers = {
  createPaymentIntent,
  capturePayment,
  refundPayment,
  getPaymentHistory,
};
