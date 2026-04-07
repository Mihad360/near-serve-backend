import HttpStatus from "http-status";
import sanitizeHtml from "sanitize-html";
import AppError from "../../../erros/AppError";
import { sanitizeOptions } from "../../../utils/SanitizeOptions";
import { UserModel } from "../../User/user.model";
import { JwtPayload } from "../../../interface/global";
import { TermsModel } from "./Terms.model";

const createTerms = async (
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

  const newTerms = await TermsModel.create({
    description: sanitizedContent,
  });
  return newTerms;
};

const getAllTerms = async () => {
  const terms = await TermsModel.find().sort({ createdAt: -1 });
  return terms[0] || null;
};

const updateTerms = async (
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

  const updatedTerms = await TermsModel.findOneAndUpdate(
    {},
    { description: sanitizedDescription },
    { new: true, upsert: true },
  );

  if (!updatedTerms) {
    throw new AppError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      "Failed to update terms",
    );
  }

  return updatedTerms;
};

export const termsServices = {
  createTerms,
  getAllTerms,
  updateTerms,
};
