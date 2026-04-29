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
import { BidModel } from "../Bid/bid.model";
import { sendNotification } from "../Notification/notification.utils";

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

  const bid = await BidModel.findOne({ _id: job.selectedBid }).select("price");
  if (!bid) {
    throw new AppError(HttpStatus.NOT_FOUND, "No bid found");
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
  const amountInCents = Math.round(bid.price * 100);
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
    amount: bid.price,
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
    amount: bid.price,
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

  // ─── Find payment — check both pending and authorized ────────────────────
  const payment = await PaymentModel.findOne({
    jobId: job._id,
    status: { $in: ["pending", "authorized"] }, // both statuses
    isDeleted: false,
  });

  if (!payment) {
    throw new AppError(HttpStatus.NOT_FOUND, "No payment found for this job");
  }

  // ─── Always verify with Stripe first ─────────────────────────────────────
  const stripeIntent = await stripe.paymentIntents.retrieve(
    payment.stripePaymentIntentId,
  );

  // payment must be requires_capture to capture
  // if already succeeded — it was already captured
  if (stripeIntent.status === "succeeded") {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Payment has already been captured",
    );
  }

  if (stripeIntent.status !== "requires_capture") {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      `Cannot capture payment with status: ${stripeIntent.status}`,
    );
  }

  // ─── Capture ──────────────────────────────────────────────────────────────
  const capturedIntent = await stripe.paymentIntents.capture(
    payment.stripePaymentIntentId,
  );

  // ─── Get real Stripe fee ──────────────────────────────────────────────────
  let stripeProcessingFee = 0;
  let actualCommission = payment.commissionAmount || 0;

  try {
    const charges = await stripe.charges.list({
      payment_intent: capturedIntent.id,
      limit: 1,
    });

    if (charges.data.length > 0) {
      const charge = charges.data[0];
      if (charge.balance_transaction) {
        const balanceTx = await stripe.balanceTransactions.retrieve(
          charge.balance_transaction as string,
        );
        stripeProcessingFee = parseFloat((balanceTx.fee / 100).toFixed(2));
        actualCommission = parseFloat(
          (actualCommission - stripeProcessingFee).toFixed(2),
        );
      }
    }
  } catch (err) {
    console.log("Could not retrieve Stripe fee:", err);
  }

  const updatedPayment = await PaymentModel.findByIdAndUpdate(
    payment._id,
    {
      $set: {
        status: "captured",
        capturedAt: new Date(),
        stripeProcessingFee,
        actualCommission,
      },
    },
    { new: true },
  );

  const providerDoc = await ProviderModel.findByIdAndUpdate(
    payment.providerId,
    { $inc: { totalEarnings: payment.providerPayout } },
    { new: true },
  );

  if (providerDoc) {
    await sendNotification({
      recipientId: providerDoc.userId,
      type: "payment_captured",
      title: "Payment Released",
      message: `$${payment.providerPayout} has been released to your account.`,
      data: {
        jobId: payment.jobId.toString(),
        amount: payment.providerPayout,
      },
    });
  }

  return updatedPayment;
};

// ─── Refund Payment (admin) ───────────────────────────────────────────────────
// ─── Cancel Payment (before capture) ─────────────────────────────────────────
const cancelPayment = async (jobId: string, reason?: string) => {
  const payment = await PaymentModel.findOne({
    jobId: new Types.ObjectId(jobId),
    status: { $in: ["pending", "authorized"] },
    isDeleted: false,
  });

  if (!payment) {
    throw new AppError(HttpStatus.NOT_FOUND, "No payment found for this job");
  }

  // verify with Stripe
  const stripeIntent = await stripe.paymentIntents.retrieve(
    payment.stripePaymentIntentId,
  );

  if (stripeIntent.status !== "requires_capture") {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      `Cannot cancel payment with Stripe status: ${stripeIntent.status}. Use refund instead.`,
    );
  }

  await stripe.paymentIntents.cancel(payment.stripePaymentIntentId);

  const updatedPayment = await PaymentModel.findByIdAndUpdate(
    payment._id,
    {
      $set: {
        status: "refunded",
        refundAmount: payment.amount,
        refundReason: reason || "Payment cancelled before capture",
        refundedAt: new Date(),
      },
    },
    { new: true },
  );

  return updatedPayment;
};

// ─── Refund Payment (after capture) ──────────────────────────────────────────
const refundPayment = async (
  jobId: string,
  refundAmount?: number,
  refundReason?: string,
  reverseProviderTransfer: boolean = true,
) => {
  const payment = await PaymentModel.findOne({
    jobId: new Types.ObjectId(jobId),
    status: "captured",
    isDeleted: false,
  });

  if (!payment) {
    throw new AppError(
      HttpStatus.NOT_FOUND,
      "No captured payment found for this job",
    );
  }

  // verify with Stripe
  const stripeIntent = await stripe.paymentIntents.retrieve(
    payment.stripePaymentIntentId,
  );

  if (stripeIntent.status !== "succeeded") {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      `Cannot refund payment with Stripe status: ${stripeIntent.status}. Use cancel instead.`,
    );
  }

  const amountToRefund = refundAmount
    ? Math.round(refundAmount * 100)
    : undefined;

  // ─── Reverse provider transfer if enabled ─────────────────────────────────
  if (reverseProviderTransfer) {
    try {
      const provider = await ProviderModel.findById(payment.providerId);

      if (provider?.stripeAccountId) {
        const transfers = await stripe.transfers.list({
          destination: provider.stripeAccountId,
          limit: 10,
        });

        const matchingTransfer = transfers.data.find(
          (t) => t.transfer_group === stripeIntent.transfer_group,
        );

        if (matchingTransfer) {
          const reverseAmount = refundAmount
            ? Math.round(
                (refundAmount / payment.amount) *
                  (payment.providerPayout || 0) *
                  100,
              )
            : undefined;

          await stripe.transfers.createReversal(matchingTransfer.id, {
            ...(reverseAmount && { amount: reverseAmount }),
          });
        }
      }
    } catch (err) {
      console.log("Transfer reversal failed:", err);
    }
  }

  // ─── Refund customer ───────────────────────────────────────────────────────
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

  if (reverseProviderTransfer) {
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

  const totalVolume = allCaptured.reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalCalculatedCommission = allCaptured.reduce(
    (sum, p) => sum + (p.commissionAmount || 0),
    0,
  );

  const totalStripeFees = allCaptured.reduce(
    (sum, p) => sum + (p.stripeProcessingFee || 0),
    0,
  );

  // actual earnings after stripe cuts
  const totalActualCommission = allCaptured.reduce(
    (sum, p) => sum + (p.actualCommission || 0),
    0,
  );

  const totalProviderPayout = allCaptured.reduce(
    (sum, p) => sum + (p.providerPayout || 0),
    0,
  );

  return {
    meta,
    result,
    summary: {
      totalVolume: parseFloat(totalVolume.toFixed(2)),
      totalCalculatedCommission: parseFloat(
        totalCalculatedCommission.toFixed(2),
      ),
      totalStripeFees: parseFloat(totalStripeFees.toFixed(2)),
      totalActualCommission: parseFloat(totalActualCommission.toFixed(2)), // real number
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
  cancelPayment,
};
