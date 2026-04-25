/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import HttpStatus from "http-status";
import { Request, Response } from "express";
import AppError from "../../erros/AppError";
import config from "../../config";
import { stripe } from "./stripe";
import { confirmPayment } from "../../modules/Payment/payment.service";
import { PaymentModel } from "../../modules/Payment/payment.model";

export const stripeWebhookHandler = async (req: Request, res: Response) => {
  let event;
  const signature = req.headers["stripe-signature"] as string;
  const endpointSecret = config.STRIPE_WEBHOOK_SECRET as string;

  try {
    if (!signature) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Missing stripe signature");
    }

    event = stripe.webhooks.constructEvent(
      req.body, // raw buffer
      signature,
      endpointSecret,
    );
  } catch (err: any) {
    return res.status(400).json({
      error: "Invalid webhook signature",
    });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object; // ✅ use PaymentIntent type
        await confirmPayment(intent.id);
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object; // ✅ use PaymentIntent type
        await PaymentModel.findOneAndUpdate(
          { stripePaymentIntentId: intent.id },
          { $set: { status: "failed" } },
          { new: true },
        );
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (error: any) {
    // Don't expose internal errors to Stripe
    return res.status(200).json({ received: true });
  }
};
