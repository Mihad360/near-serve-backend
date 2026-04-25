// backend/src/modules/Review/review.interface.ts

import { Types } from "mongoose";

export interface IReview {
  _id?: Types.ObjectId;
  jobId: Types.ObjectId;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  rating: number;
  comment?: string;
  providerReply?: string;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
