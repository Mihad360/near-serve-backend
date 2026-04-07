/* eslint-disable @typescript-eslint/no-explicit-any */
import { TErrorSource, TResponseErrorType } from "../interface/error";

export const handleDuplicateError = (err: any): TResponseErrorType => {
  let field = "";
  let value = "";

  if (err?.keyValue) {
    const entry = Object.entries(err.keyValue)[0];
    field = entry?.[0] || "";
    value = entry?.[1] !== undefined ? String(entry[1]) : "";
  } else {
    const match = err?.message.match(/"([^"]*)"/);
    value = match?.[1] || "Field";
  }

  const errorSource: TErrorSource = [
    {
      path: field,
      message: `${value} already exists`,
    },
  ];

  return {
    statusCode: 400,
    message: "Duplicate Key Error",
    errorSource,
  };
};
