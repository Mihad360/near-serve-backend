export type TErrorSource = {
  path: number | string;
  message: string;
}[];

export type TResponseErrorType = {
  statusCode: number;
  message: string;
  errorSource: TErrorSource
};
