/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// backend/src/utils/stripe/stripeWebhook.ts

import { Request, Response } from "express";
import Stripe from "stripe";
import { stripe } from "./stripe";
import config from "../../config";
import { confirmPayment } from "../../modules/Payment/payment.service";
import { PaymentModel } from "../../modules/Payment/payment.model";
import { ProviderModel } from "../../modules/Providers/provider.model";
import AppError from "../../erros/AppError";

// ─── Webhook 1 — Account webhook (payments) ───────────────────────────────────
export const stripeWebhookHandler = async (req: Request, res: Response) => {
  console.log("🔥 Stripe Webhook HIT");

  let event;
  const signature = req.headers["stripe-signature"] as string;

  console.log("➡️ Signature:", signature ? "Exists" : "Missing");

  try {
    if (!signature) {
      console.log("❌ Missing signature");
      return res.status(400).json({ error: "Missing stripe signature" });
    }

    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      config.STRIPE_WEBHOOK_SECRET as string,
    );

    console.log("✅ Event verified:", event.type);
  } catch (err: any) {
    console.log("❌ Signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  try {
    console.log("📦 Processing event:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log("💰 Checkout completed:", session.id);

        const paymentIntentId = session.payment_intent as string;

        if (paymentIntentId) {
          console.log("➡️ Confirming payment:", paymentIntentId);
          // pass both paymentIntentId and sessionId
          await confirmPayment(paymentIntentId, session.id);
        }
        break;
      }

      case "payment_intent.succeeded": {
        const intent = event.data.object;
        console.log("✅ Payment succeeded:", intent.id);

        await confirmPayment(intent.id);
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object;
        console.log("❌ Payment failed:", intent.id);

        await PaymentModel.findOneAndUpdate(
          { stripePaymentIntentId: intent.id },
          { $set: { status: "failed" } },
        );
        break;
      }

      case "payment_intent.canceled": {
        const intent = event.data.object;
        console.log("⚠️ Payment canceled:", intent.id);

        await PaymentModel.findOneAndUpdate(
          { stripePaymentIntentId: intent.id },
          { $set: { status: "failed" } },
        );
        break;
      }

      default:
        console.log("ℹ️ Unhandled event type:", event.type);
    }

    return res.json({ received: true });
  } catch (error: any) {
    console.log("🔥 Webhook processing error:", error.message);
    return res.status(200).json({ received: true });
  }
};

// ─── Webhook 2 — Connect webhook (provider onboarding) ───────────────────────
export const stripeConnectWebhookHandler = async (
  req: Request,
  res: Response,
) => {
  console.log("🔥 Stripe CONNECT Webhook HIT");

  let event;
  const signature = req.headers["stripe-signature"] as string;

  console.log("➡️ Signature:", signature ? "Exists" : "Missing");

  try {
    if (!signature) {
      console.log("❌ Missing signature");
      return res.status(400).json({ error: "Missing stripe signature" });
    }

    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      config.STRIPE_CONNECT_WEBHOOK_SECRET as string,
    );

    console.log("✅ Event verified:", event.type);
  } catch (err: any) {
    console.log("❌ Signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  try {
    console.log("📦 Processing event:", event.type);

    switch (event.type) {
      case "account.updated": {
        const account = event.data.object;

        console.log("🔄 Account updated:", account.id);
        console.log("➡️ charges_enabled:", account.charges_enabled);

        const status = account.charges_enabled ? "active" : "pending";

        const updated = await ProviderModel.findOneAndUpdate(
          { stripeAccountId: account.id },
          { $set: { stripeAccountStatus: status } },
          { new: true },
        );

        console.log("✅ DB updated:", updated ? "YES" : "NOT FOUND");

        if (!updated) {
          throw new AppError(400, "Account status update failed");
        }

        break;
      }

      case "account.application.deauthorized": {
        const deauth = event.data.object;

        console.log("🚫 Account deauthorized:", deauth.id);

        await ProviderModel.findOneAndUpdate(
          { stripeAccountId: deauth.id },
          {
            $set: {
              stripeAccountId: null,
              stripeAccountStatus: "pending",
            },
          },
        );

        break;
      }

      default:
        console.log("ℹ️ Unhandled event type:", event.type);
    }

    return res.json({ received: true });
  } catch (error: any) {
    console.log("🔥 Connect webhook error:", error.message);
    return res.status(200).json({ received: true });
  }
};
