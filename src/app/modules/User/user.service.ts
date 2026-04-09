import HttpStatus from "http-status";
import { Types } from "mongoose";
import { JwtPayload } from "../../interface/global";
import { UserModel } from "./user.model";
import AppError from "../../erros/AppError";
import QueryBuilder from "../../../builder/QueryBuilder";
import { sendFileToCloudinary } from "../../utils/sendImageToCloudinary";
import { IProvider } from "../Providers/provider.interface";
import { ProviderModel } from "../Providers/provider.model";

const getMe = async (user: JwtPayload) => {
  const userId = new Types.ObjectId(user.user);
  const isUserExist = await UserModel.findById(userId).select(
    "-password -fcmToken -otp -passwordChangedAt -expiresAt",
  );
  if (!isUserExist) {
    throw new AppError(HttpStatus.NOT_FOUND, "The user is not exist");
  }
  return isUserExist;
};

const getUsers = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(
    UserModel.find(
      { isDeleted: false },
      "-fcmToken -password -otp -expiresAt -isVerified -passwordChangedAt -currentSubscriptionId -hasActiveSubscription",
    ),
    query,
  )
    // .search(searchUsers)
    .filter()
    .sort()
    .paginate()
    .fields();
  const meta = await userQuery.countTotal();
  const result = await userQuery.modelQuery;
  return { meta, result };
};

// ─── Update Provider Profile ──────────────────────────────────────────────────
// finds user first → uses userId to update provider
// also updates user fields (name, phone, location) in user model
const editProfile = async (
  userInfo: JwtPayload,
  files: {
    image?: Express.Multer.File[];
    portfolio?: Express.Multer.File[];
  },
  payload: Partial<
    IProvider & { name?: string; phone?: string; location?: object }
  >,
) => {
  const id = new Types.ObjectId(userInfo.user);
  const user = await UserModel.findById(id);

  if (!user) {
    throw new AppError(HttpStatus.NOT_FOUND, "User not found");
  }

  if (user.isDeleted) {
    throw new AppError(HttpStatus.FORBIDDEN, "This user is deleted");
  }

  // 🔹 Get existing provider
  const existingProvider = await ProviderModel.findOne({ userId: user._id });

  let portfolioUrls: string[] = existingProvider?.portfolio || [];

  // ✅ Handle multiple portfolio uploads
  if (files?.portfolio?.length) {
    const uploaded = await Promise.all(
      files.portfolio.map((file) =>
        sendFileToCloudinary(file.buffer, file.originalname, file.mimetype),
      ),
    );

    const newUrls = uploaded.map((img) => img.secure_url);

    // append new images
    portfolioUrls = [...portfolioUrls, ...newUrls];
  }

  // attach portfolio back to payload
  if (files?.portfolio?.length) {
    payload.portfolio = portfolioUrls;
  }

  // 🔹 split user fields from provider fields
  const { name, phone, location, ...providerPayload } = payload;

  // ✅ Update user fields
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
      { new: true },
    );
  }

  const updatedProvider = await ProviderModel.findOneAndUpdate(
    { userId: user._id },
    { $set: providerPayload },
    { new: true },
  ).populate("userId", "name email phone location profileImage");

  return updatedProvider;
};

export const userServices = {
  getMe,
  getUsers,
  editProfile,
};
