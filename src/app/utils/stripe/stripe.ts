import Stripe from "stripe";
import config from "../../config";

export const stripe = new Stripe(config.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});
