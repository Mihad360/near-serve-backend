// backend/src/modules/provider/provider.service.ts

import HttpStatus from "http-status";
import { Types } from "mongoose";
import { JwtPayload } from "../../interface/global";
import QueryBuilder from "../../../builder/QueryBuilder";
import { IProvider } from "./provider.interface";
import { sendFileToCloudinary } from "../../utils/sendImageToCloudinary";
import { ProviderModel } from "./provider.model";
import AppError from "../../erros/AppError";
import { UserModel } from "../User/user.model";

// ─── Setup Provider Profile ──────────────────────────────────────────────────
const setupProfile = async (user: JwtPayload, payload: Partial<IProvider>) => {
  const userId = new Types.ObjectId(user.user);

  const alreadyExists = await ProviderModel.findOne({ userId });
  if (alreadyExists) {
    throw new AppError(HttpStatus.CONFLICT, "Provider profile already exists");
  }

  const provider = await ProviderModel.create({
    ...payload,
    userId,
  });

  return provider;
};

// ─── Get My Provider Profile ──────────────────────────────────────────────────
const getMyProfile = async (user: JwtPayload) => {
  const userId = new Types.ObjectId(user.user);

  const provider = await ProviderModel.findOne({ userId }).populate(
    "userId",
    "name email avatar phone",
  );

  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider profile not found");
  }

  return provider;
};

// ─── Get Single Provider (public) ────────────────────────────────────────────
const getProviderById = async (providerId: string) => {
  const provider = await ProviderModel.findById(providerId).populate(
    "userId",
    "name email avatar phone",
  );

  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider not found");
  }

  if (!provider.isApproved) {
    throw new AppError(HttpStatus.FORBIDDEN, "Provider is not approved yet");
  }

  return provider;
};

// ─── Get All Providers (admin) ────────────────────────────────────────────────
const getAllProviders = async (query: Record<string, unknown>) => {
  const providerQuery = new QueryBuilder(
    ProviderModel.find().populate("userId", "name email avatar phone"),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await providerQuery.countTotal();
  const result = await providerQuery.modelQuery;

  return { meta, result };
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

// ─── Update Provider Profile ──────────────────────────────────────────────────
// finds user first → uses userId to update provider
// also updates user fields (name, phone, location) in user model
const updateProfile = async (
  id: string,
  file: Express.Multer.File,
  payload: Partial<
    IProvider & { name?: string; phone?: string; location?: object }
  >,
) => {
  const user = await UserModel.findById(id);

  if (!user) {
    throw new AppError(HttpStatus.NOT_FOUND, "User not found");
  }

  if (user.isDeleted) {
    throw new AppError(HttpStatus.FORBIDDEN, "This user is deleted");
  }

  // handle portfolio image upload
  if (file) {
    const uploadResult = await sendFileToCloudinary(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    const existingProvider = await ProviderModel.findOne({ userId: user._id });
    payload.portfolio = [
      ...(existingProvider?.portfolio || []),
      uploadResult.secure_url,
    ];
  }

  // split user fields from provider fields
  const { name, phone, location, ...providerPayload } = payload;

  // update user fields if provided
  if (name || phone || location) {
    await UserModel.findByIdAndUpdate(
      id,
      {
        $set: {
          ...(name && { name }),
          ...(phone && { phone }),
          ...(location && { location }),
        },
      },
      { new: true, runValidators: true },
    );
  }

  // prevent sensitive provider fields from being updated
  delete providerPayload.trustScore;
  delete providerPayload.completionRate;
  delete providerPayload.avgResponseTime;
  delete providerPayload.totalEarnings;
  delete providerPayload.totalJobs;
  delete providerPayload.isApproved;
  delete providerPayload.stripeSubscriptionId;
  delete providerPayload.subscriptionTier;

  const updatedProvider = await ProviderModel.findOneAndUpdate(
    { userId: user._id },
    { $set: providerPayload },
    { new: true, runValidators: true },
  ).populate("userId", "name email avatar phone location");

  return updatedProvider;
};

// ─── Approve Provider (admin) ─────────────────────────────────────────────────
const approveProvider = async (providerId: string) => {
  const provider = await ProviderModel.findByIdAndUpdate(
    providerId,
    { $set: { isApproved: true } },
    { new: true, runValidators: true },
  );

  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider not found");
  }

  return provider;
};

export const providerServices = {
  setupProfile,
  getMyProfile,
  getProviderById,
  getAllProviders,
  searchNearbyProviders,
  updateProfile,
  approveProvider,
};
