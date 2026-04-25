// backend/src/modules/Payment/payment.service.ts

import HttpStatus from "http-status";
import { Types } from "mongoose";
import { JwtPayload } from "../../interface/global";
import { PaymentModel } from "./payment.model";
import { JobModel } from "../Jobs/job.model";
import { ProviderModel } from "../Providers/provider.model";
import { UserModel } from "../User/user.model";
import AppError from "../../erros/AppError";
import QueryBuilder from "../../../builder/QueryBuilder";
import { stripe } from "../../utils/stripe/stripe";

// ─── Create Payment Intent (customer — after bid accepted) ────────────────────
const createPaymentIntent = async (user: JwtPayload, jobId: string) => {
  const customerId = new Types.ObjectId(user.user);

  const job = await JobModel.findById(jobId);
  if (!job) {
    throw new AppError(HttpStatus.NOT_FOUND, "Job not found");
  }

  // only job owner can pay
  if (!job.customerId.equals(customerId)) {
    throw new AppError(HttpStatus.FORBIDDEN, "This is not your job");
  }

  // job must be booked to create payment
  if (job.status !== "booked") {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Job must be booked before payment",
    );
  }

  // check if payment already exists for this job
  const existingPayment = await PaymentModel.findOne({
    jobId: job._id,
    status: { $in: ["pending", "authorized"] },
    isDeleted: false,
  });

  if (existingPayment) {
    throw new AppError(
      HttpStatus.CONFLICT,
      "Payment already exists for this job",
    );
  }

  // get or create Stripe customer
  const customerUser = await UserModel.findById(customerId);
  if (!customerUser) {
    throw new AppError(HttpStatus.NOT_FOUND, "User not found");
  }

  let stripeCustomerId = customerUser.stripeCustomerId;

  if (!stripeCustomerId) {
    const stripeCustomer = await stripe.customers.create({
      email: customerUser.email,
      name: customerUser.name,
      metadata: { userId: customerId.toString() },
    });
    stripeCustomerId = stripeCustomer.id;

    // save stripe customer id to user
    await UserModel.findByIdAndUpdate(
      customerId,
      { $set: { stripeCustomerId } },
      { new: true },
    );
  }

  // get provider for reference
  const provider = await ProviderModel.findById(job.selectedProvider);
  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider not found");
  }

  // amount in cents — budget is the payment amount
  const amountInCents = Math.round(job.budget * 100);

  // create stripe payment intent with manual capture — escrow
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: "usd",
    customer: stripeCustomerId,
    capture_method: "manual", // key — money held, not captured yet
    metadata: {
      jobId: jobId,
      customerId: customerId.toString(),
      providerId: provider._id.toString(),
    },
  });

  // save payment record to db
  const payment = await PaymentModel.create({
    jobId: job._id,
    customerId,
    providerId: provider._id,
    stripePaymentIntentId: paymentIntent.id,
    amount: job.budget,
    currency: "usd",
    status: "pending",
  });

  return {
    clientSecret: paymentIntent.client_secret, // sent to frontend for card input
    paymentId: payment._id,
    amount: job.budget,
  };
};

// ─── Confirm Payment (webhook or manual — after card authorized) ──────────────
export const confirmPayment = async (stripePaymentIntentId: string) => {
  const payment = await PaymentModel.findOne({ stripePaymentIntentId });
  if (!payment) {
    throw new AppError(HttpStatus.NOT_FOUND, "Payment not found");
  }

  await PaymentModel.findByIdAndUpdate(
    payment._id,
    { $set: { status: "authorized" } },
    { new: true },
  );

  return payment;
};

// ─── Capture Payment (customer marks job completed) ───────────────────────────
const capturePayment = async (user: JwtPayload, jobId: string) => {
  const customerId = new Types.ObjectId(user.user);

  const job = await JobModel.findById(jobId);
  if (!job) {
    throw new AppError(HttpStatus.NOT_FOUND, "Job not found");
  }

  if (!job.customerId.equals(customerId)) {
    throw new AppError(HttpStatus.FORBIDDEN, "This is not your job");
  }

  if (job.status !== "completed") {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Job must be completed before releasing payment",
    );
  }

  const payment = await PaymentModel.findOne({
    jobId: job._id,
    status: "authorized",
    isDeleted: false,
  });

  if (!payment) {
    throw new AppError(
      HttpStatus.NOT_FOUND,
      "No authorized payment found for this job",
    );
  }

  // capture the payment — money moves now
  await stripe.paymentIntents.capture(payment.stripePaymentIntentId);

  const updatedPayment = await PaymentModel.findByIdAndUpdate(
    payment._id,
    {
      $set: {
        status: "captured",
        capturedAt: new Date(),
      },
    },
    { new: true },
  );

  // update provider total earnings
  await ProviderModel.findByIdAndUpdate(
    payment.providerId,
    { $inc: { totalEarnings: payment.amount } },
    { new: true },
  );

  return updatedPayment;
};

// ─── Refund Payment (admin only) ──────────────────────────────────────────────
const refundPayment = async (
  jobId: string,
  refundAmount?: number,
  refundReason?: string,
) => {
  const payment = await PaymentModel.findOne({
    jobId: new Types.ObjectId(jobId),
    status: { $in: ["authorized", "captured"] },
    isDeleted: false,
  });

  if (!payment) {
    throw new AppError(HttpStatus.NOT_FOUND, "No payment found for this job");
  }

  const amountToRefund = refundAmount
    ? Math.round(refundAmount * 100)
    : undefined; // undefined = full refund

  // issue refund via stripe
  await stripe.refunds.create({
    payment_intent: payment.stripePaymentIntentId,
    ...(amountToRefund && { amount: amountToRefund }),
    reason: "requested_by_customer",
  });

  const updatedPayment = await PaymentModel.findByIdAndUpdate(
    payment._id,
    {
      $set: {
        status: "refunded",
        refundAmount: refundAmount || payment.amount,
        refundReason: refundReason || "Admin issued refund",
        refundedAt: new Date(),
      },
    },
    { new: true },
  );

  return updatedPayment;
};

// ─── Get Payment History ──────────────────────────────────────────────────────
const getPaymentHistory = async (
  user: JwtPayload,
  query: Record<string, unknown>,
) => {
  const userId = new Types.ObjectId(user.user);
  const userRole = user.role;

  const filter: Record<string, unknown> = { isDeleted: false };

  if (userRole === "customer") {
    filter.customerId = userId;
  } else if (userRole === "provider") {
    const provider = await ProviderModel.findOne({ userId });
    if (!provider) {
      throw new AppError(HttpStatus.NOT_FOUND, "Provider not found");
    }
    filter.providerId = provider._id;
  }

  const paymentQuery = new QueryBuilder(
    PaymentModel.find(filter)
      .populate("jobId", "title category status scheduledAt")
      .populate("customerId", "name email")
      .populate("providerId", "userId trustScore"),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await paymentQuery.countTotal();
  const result = await paymentQuery.modelQuery;

  return { meta, result };
};

export const paymentServices = {
  createPaymentIntent,
  capturePayment,
  refundPayment,
  getPaymentHistory,
};
