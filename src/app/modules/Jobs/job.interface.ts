import { Types } from "mongoose";

// ─── Payment Sub-interface ───────────────────────────────────────────────────
interface IPayment {
  stripePaymentIntentId?: string;
  amount?: number;
  currency?: string;
  status?: "pending" | "authorized" | "captured" | "refunded" | "failed";
}

// ─── Location Sub-interface ──────────────────────────────────────────────────
interface ILocation {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

// ─── Job Interface ───────────────────────────────────────────────────────────
export interface IJob {
  _id?: Types.ObjectId;
  customerId: Types.ObjectId; // ref to User
  selectedProvider?: Types.ObjectId; // ref to Provider
  selectedBid?: Types.ObjectId; // ref to Bid
  title: string;
  description: string;
  category: string;
  location: ILocation;
  budget: number;
  status?:
    | "open"
    | "bidding"
    | "booked"
    | "in_progress"
    | "completed"
    | "disputed"
    | "cancelled";
  payment?: IPayment;
  scheduledAt: Date;
  expiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
