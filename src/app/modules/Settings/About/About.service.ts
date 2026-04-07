import HttpStatus from "http-status";
import sanitizeHtml from "sanitize-html";
import AppError from "../../../erros/AppError";
import { sanitizeOptions } from "../../../utils/SanitizeOptions";
import { AboutModel } from "./About.model";
import { JwtPayload } from "../../../interface/global";
import { UserModel } from "../../User/user.model";

const createAbout = async (
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

  const newAbout = await AboutModel.create({ description: sanitizedContent });
  return newAbout;
};

const getAllAbout = async () => {
  const about = await AboutModel.find().sort({ createdAt: -1 });
  return about[0] || null;
};

const updateAbout = async (
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

  const updatedAbout = await AboutModel.findOneAndUpdate(
    {},
    { description: sanitizedDescription },
    { new: true, upsert: true },
  );

  if (!updatedAbout) {
    throw new AppError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      "Failed to update about",
    );
  }

  return updatedAbout;
};

export const aboutServices = {
  createAbout,
  getAllAbout,
  updateAbout,
};
