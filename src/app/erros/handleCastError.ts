import mongoose from "mongoose";
import { TErrorSource, TResponseErrorType } from "../interface/error";

export const handleCastError = (
  err: mongoose.Error.CastError,
): TResponseErrorType => {
  const errorSource: TErrorSource = [
    {
      path: err.path || "unknown",
      message: err.message || "Invalid value for field",
    },
  ];

  return {
    statusCode: 400,
    message: "Cast Error",
    errorSource,
  };
};
