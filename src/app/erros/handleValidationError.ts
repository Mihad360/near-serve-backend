import mongoose from "mongoose";
import { TErrorSource, TResponseErrorType } from "../interface/error";

export const handleValidationError = (
  err: mongoose.Error.ValidationError,
): TResponseErrorType => {
  const errorSource: TErrorSource = Object.values(err.errors).map((val) => {
    return {
      path: "path" in val ? val.path : "unknown",
      message: val.message || "Validation error",
    };
  });

  return {
    statusCode: 400,
    message: "Validation Error",
    errorSource,
  };
};
