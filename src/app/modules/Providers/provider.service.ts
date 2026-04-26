import HttpStatus from "http-status";
import { ProviderModel } from "./provider.model";
import AppError from "../../erros/AppError";
import { JwtPayload } from "../../interface/global";
import { stripe } from "../../utils/stripe/stripe";
import config from "../../config";
import { Types } from "mongoose";
import { UserModel } from "../User/user.model";

// ─── Get Single Provider (public) ────────────────────────────────────────────
const getProviderById = async (providerId: string) => {
  const provider = await ProviderModel.findById(providerId).populate(
    "userId",
    "name email avatar phone",
  );

  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider not found");
  }

  return provider;
};

// ─── Search Nearby Providers ──────────────────────────────────────────────────
const searchNearbyProviders = async (
  latitude: number,
  longitude: number,
  radiusKm: number,
  category?: string,
) => {
  const radiusInMeters = radiusKm * 1000;

  const filter: Record<string, unknown> = {
    isApproved: true,
    isAvailable: true,
  };

  if (category) {
    filter.categories = { $in: [category.toLowerCase()] };
  }

  const providers = await ProviderModel.find(filter)
    .populate({
      path: "userId",
      select: "name email avatar phone location",
      match: {
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            $maxDistance: radiusInMeters,
          },
        },
      },
    })
    .sort({ trustScore: -1 });

  const nearby = providers.filter((p) => p.userId !== null);

  return nearby;
};

// ─── Create Stripe Connect Account (provider) ─────────────────────────────────
const createStripeAccount = async (user: JwtPayload) => {
  const userId = new Types.ObjectId(user.user);

  const providerUser = await UserModel.findById(userId);
  if (!providerUser) {
    throw new AppError(HttpStatus.NOT_FOUND, "User not found");
  }

  const provider = await ProviderModel.findOne({ userId });
  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider profile not found");
  }

  // if already has account — return existing
  if (provider.stripeAccountId) {
    return { stripeAccountId: provider.stripeAccountId };
  }

  const account = await stripe.accounts.create({
    type: "express",
    email: providerUser.email,
    metadata: {
      providerId: provider._id.toString(),
      userId: userId.toString(),
    },
  });

  // update and verify it saved
  const updated = await ProviderModel.findByIdAndUpdate(
    provider._id,
    {
      $set: {
        stripeAccountId: account.id,
        stripeAccountStatus: "pending",
      },
    },
    { new: true },
  );

  if (!updated?.stripeAccountId) {
    throw new AppError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      "Failed to save Stripe account ID",
    );
  }

  console.log("✅ Stripe account saved:", updated.stripeAccountId);

  return { stripeAccountId: account.id };
};

// ─── Generate Stripe Onboarding Link (provider) ───────────────────────────────
const getStripeOnboardingLink = async (user: JwtPayload) => {
  const userId = new Types.ObjectId(user.user);

  const provider = await ProviderModel.findOne({ userId });
  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider profile not found");
  }

  if (!provider.stripeAccountId) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Please create your Stripe account first",
    );
  }

  // generate onboarding link — provider completes KYC on Stripe's page
  const accountLink = await stripe.accountLinks.create({
    account: provider.stripeAccountId,
    refresh_url: `${config.LOCAL_URL}/provider/stripe/refresh`,
    return_url: `${config.LOCAL_URL}/provider/stripe/success`,
    type: "account_onboarding",
  });

  return { url: accountLink.url };
};

// ─── Check Stripe Account Status (provider) ───────────────────────────────────
const checkStripeAccountStatus = async (user: JwtPayload) => {
  const userId = new Types.ObjectId(user.user);

  const provider = await ProviderModel.findOne({ userId });
  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider profile not found");
  }

  if (!provider.stripeAccountId) {
    throw new AppError(HttpStatus.BAD_REQUEST, "No Stripe account found");
  }

  const account = await stripe.accounts.retrieve(provider.stripeAccountId);

  // update status based on charges_enabled
  const status = account.charges_enabled ? "active" : "pending";

  await ProviderModel.findByIdAndUpdate(
    provider._id,
    { $set: { stripeAccountStatus: status } },
    { new: true },
  );

  return {
    stripeAccountId: provider.stripeAccountId,
    status,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
  };
};

export const providerServices = {
  getProviderById,
  searchNearbyProviders,
  createStripeAccount,
  getStripeOnboardingLink,
  checkStripeAccountStatus,
};
