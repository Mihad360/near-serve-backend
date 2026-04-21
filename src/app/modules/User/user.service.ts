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
      "-fcmToken -password -otp -expiresAt -isVerified -passwordChangedAt",
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
  const userRole = userInfo.role;

  const user = await UserModel.findById(id);

  if (!user) {
    throw new AppError(HttpStatus.NOT_FOUND, "User not found");
  }

  if (user.isDeleted) {
    throw new AppError(HttpStatus.FORBIDDEN, "This user is deleted");
  }

  // ─── Handle profile image upload (both customer and provider) ────────────
  if (files?.image?.length) {
    const uploadResult = await sendFileToCloudinary(
      files.image[0].buffer,
      files.image[0].originalname,
      files.image[0].mimetype,
    );
    await UserModel.findByIdAndUpdate(
      id,
      { $set: { profileImage: uploadResult.secure_url } },
      { new: true },
    );
  }

  // ─── Split user fields from provider fields ───────────────────────────────
  const { name, phone, location, ...providerPayload } = payload;

  // ─── Update user fields (both roles) ─────────────────────────────────────
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

  // ─── If customer — stop here, return updated user ─────────────────────────
  if (userRole === "customer") {
    const updatedUser = await UserModel.findById(id).select(
      "-password -otp -expiresAt -passwordChangedAt -fcmToken",
    );
    return updatedUser;
  }

  // ─── If provider — also update provider doc ───────────────────────────────
  if (userRole === "provider") {
    const existingProvider = await ProviderModel.findOne({ userId: user._id });

    // ─── Handle portfolio upload (provider only) ──────────────────────────
    if (files?.portfolio?.length) {
      const uploaded = await Promise.all(
        files.portfolio.map((file) =>
          sendFileToCloudinary(file.buffer, file.originalname, file.mimetype),
        ),
      );
      const newUrls = uploaded.map((img) => img.secure_url);
      providerPayload.portfolio = [
        ...(existingProvider?.portfolio || []),
        ...newUrls,
      ];
    }

    // normalize categories to lowercase if provided
    if (providerPayload.categories) {
      providerPayload.categories = providerPayload.categories.map((c: string) =>
        c.toLowerCase(),
      );
    }

    const updatedProvider = await ProviderModel.findOneAndUpdate(
      { userId: user._id },
      { $set: providerPayload },
      { new: true, upsert: true },
    ).populate("userId", "name email phone location profileImage");

    return updatedProvider;
  }
};

export const userServices = {
  getMe,
  getUsers,
  editProfile,
};
