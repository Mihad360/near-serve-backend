// backend/src/modules/Job/job.interface.ts

import { Types } from "mongoose";

export interface IJob {
  _id?: Types.ObjectId;
  customerId: Types.ObjectId;
  selectedProvider?: Types.ObjectId | null;
  selectedBid?: Types.ObjectId | null;
  title: string;
  description: string;
  category: string;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  budget: number;
  status?:
    | "open"
    | "bidding"
    | "booked"
    | "in_progress"
    | "completed"
    | "disputed"
    | "cancelled";
  scheduledAt: Date;
  expiresAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
