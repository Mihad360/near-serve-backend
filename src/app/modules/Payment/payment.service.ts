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
import config from "../../config";

// ─── Create Payment Intent with Connect ───────────────────────────────────────
const createPaymentIntent = async (user: JwtPayload, jobId: string) => {
  const customerId = new Types.ObjectId(user.user);

  const job = await JobModel.findById(jobId);
  if (!job) {
    throw new AppError(HttpStatus.NOT_FOUND, "Job not found");
  }

  if (!job.customerId.equals(customerId)) {
    throw new AppError(HttpStatus.FORBIDDEN, "This is not your job");
  }

  if (job.status !== "booked") {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Job must be booked before payment",
    );
  }

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

  const customerUser = await UserModel.findById(customerId);
  if (!customerUser) {
    throw new AppError(HttpStatus.NOT_FOUND, "User not found");
  }

  const provider = await ProviderModel.findById(job.selectedProvider);
  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider not found");
  }

  if (!provider.stripeAccountId) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Provider has not set up their payment account yet",
    );
  }

  if (provider.stripeAccountStatus !== "active") {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Provider payment account is not fully active yet",
    );
  }

  // ─── Calculate commission ──────────────────────────────────────────────────
  const commissionRate = Number(config.STRIPE_COMMISSION_RATE);
  const amountInCents = Math.round(job.budget * 100);
  const commissionInCents = Math.round((amountInCents * commissionRate) / 100);
  const providerPayoutInCents = amountInCents - commissionInCents;
  const commissionAmount = parseFloat((commissionInCents / 100).toFixed(2));
  const providerPayout = parseFloat((providerPayoutInCents / 100).toFixed(2));

  // ─── Create Stripe Checkout Session ───────────────────────────────────────
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: customerUser.email,

    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: job.title,
            description: job.description,
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      },
    ],

    payment_intent_data: {
      capture_method: "manual", // escrow — hold money
      transfer_data: {
        destination: provider.stripeAccountId,
        amount: providerPayoutInCents, // provider cut
      },
      metadata: {
        jobId: jobId.toString(),
        customerId: customerId.toString(),
        providerId: provider._id.toString(),
        commissionRate: commissionRate.toString(),
        commissionAmount: commissionAmount.toString(),
        providerPayout: providerPayout.toString(),
      },
    },

    // after payment — redirect to your frontend
    success_url: `${config.LOCAL_URL}/payment/success?jobId=${jobId}`,
    cancel_url: `${config.LOCAL_URL}/payment/cancel?jobId=${jobId}`,

    metadata: {
      jobId: jobId,
    },
  });
  // ─── Save payment record ───────────────────────────────────────────────────
  await PaymentModel.create({
    jobId: job._id,
    customerId,
    providerId: provider._id,
    stripePaymentIntentId: session.payment_intent as string,
    stripeSessionId: session.id,
    amount: job.budget,
    currency: "usd",
    status: "pending",
    commissionRate,
    commissionAmount,
    providerPayout,
  });

  // return the checkout URL — customer opens this in browser
  return {
    client_secret: session.client_secret,
    checkoutUrl: session.url,
    sessionId: session.id,
    amount: job.budget,
    commissionAmount,
    providerPayout,
  };
};

// ─── Confirm Payment (from webhook) ──────────────────────────────────────────
export const confirmPayment = async (
  stripePaymentIntentId: string,
  stripeSessionId?: string,
) => {
  let payment;
  console.log(stripePaymentIntentId);
  // try finding by paymentIntentId first
  payment = await PaymentModel.findOne({ stripePaymentIntentId });

  // if not found — find by sessionId and update paymentIntentId
  if (!payment && stripeSessionId) {
    payment = await PaymentModel.findOneAndUpdate(
      { stripeSessionId },
      { $set: { stripePaymentIntentId } },
      { new: true },
    );
  }

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

// ─── Capture Payment ──────────────────────────────────────────────────────────
// when captured — Stripe automatically sends provider their cut
// platform keeps the rest (commission)
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

  // capture — Stripe auto transfers provider payout to their account
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

  // update provider earnings in our db
  await ProviderModel.findByIdAndUpdate(
    payment.providerId,
    { $inc: { totalEarnings: payment.providerPayout } },
    { new: true },
  );

  return updatedPayment;
};

// ─── Refund Payment (admin) ───────────────────────────────────────────────────
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
    : undefined;

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

  // reverse provider earnings if already captured
  if (payment.status === "captured") {
    await ProviderModel.findByIdAndUpdate(
      payment.providerId,
      { $inc: { totalEarnings: -(payment.providerPayout || 0) } },
      { new: true },
    );
  }

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

// ─── Admin Earnings Summary ───────────────────────────────────────────────────
const getAdminEarnings = async (query: Record<string, unknown>) => {
  const paymentQuery = new QueryBuilder(
    PaymentModel.find({
      status: "captured",
      isDeleted: false,
    }),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await paymentQuery.countTotal();
  const result = await paymentQuery.modelQuery;

  const allCaptured = await PaymentModel.find({
    status: "captured",
    isDeleted: false,
  });

  const totalCommission = allCaptured.reduce(
    (sum, p) => sum + (p.commissionAmount || 0),
    0,
  );

  const totalVolume = allCaptured.reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalProviderPayout = allCaptured.reduce(
    (sum, p) => sum + (p.providerPayout || 0),
    0,
  );

  return {
    meta,
    result,
    summary: {
      totalVolume: parseFloat(totalVolume.toFixed(2)),
      totalCommission: parseFloat(totalCommission.toFixed(2)),
      totalProviderPayout: parseFloat(totalProviderPayout.toFixed(2)),
    },
  };
};

export const paymentServices = {
  createPaymentIntent,
  confirmPayment,
  capturePayment,
  refundPayment,
  getPaymentHistory,
  getAdminEarnings,
};
