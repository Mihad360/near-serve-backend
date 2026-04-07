import HttpStatus from "http-status";
import sanitizeHtml from "sanitize-html";
import AppError from "../../../erros/AppError";
import { sanitizeOptions } from "../../../utils/SanitizeOptions";
import { UserModel } from "../../User/user.model";
import { JwtPayload } from "../../../interface/global";
import { PrivacyModel } from "./Privacy.model";

const createPrivacy = async (
  payload: { description: string },
  user: JwtPayload,
) => {
  const userId = user.user;

  const isUserExist = await UserModel.findById(userId);
  if (!isUserExist) {
    throw new AppError(HttpStatus.NOT_FOUND, "User not found");
  }

  const { description } = payload;
  if (!description) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Description is required");
  }

  const sanitizedContent = sanitizeHtml(description, sanitizeOptions);

  const newPrivacy = await PrivacyModel.create({
    description: sanitizedContent,
  });
  return newPrivacy;
};

const getAllPrivacy = async () => {
  const privacy = await PrivacyModel.find().sort({ createdAt: -1 });
  return privacy[0] || null;
};

const updatePrivacy = async (
  payload: { description: string },
  user: JwtPayload,
) => {
  const userId = user.user;

  const isUserExist = await UserModel.findById(userId);
  if (!isUserExist) {
    throw new AppError(HttpStatus.NOT_FOUND, "User not found");
  }

  const { description } = payload;
  if (!description) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Description is required");
  }

  const sanitizedDescription = sanitizeHtml(description, sanitizeOptions);

  const updatedPrivacy = await PrivacyModel.findOneAndUpdate(
    {},
    { description: sanitizedDescription },
    { new: true, upsert: true },
  );

  if (!updatedPrivacy) {
    throw new AppError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      "Failed to update privacy",
    );
  }

  return updatedPrivacy;
};

const getPrivacyHtml = async () => {
  const privacy = await PrivacyModel.find().sort({ createdAt: -1 });
  const privacyData = privacy && privacy.length > 0 ? privacy[0] : null;

  if (!privacyData) {
    throw new AppError(HttpStatus.NOT_FOUND, "Privacy policy not found");
  }

  return privacyData;
};

export const privacyServices = {
  createPrivacy,
  getAllPrivacy,
  updatePrivacy,
  getPrivacyHtml,
};
