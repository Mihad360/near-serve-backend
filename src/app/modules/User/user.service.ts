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

export const userServices = {
  getMe,
  getUsers,
  editProfile,
};
