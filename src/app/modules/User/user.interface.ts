import { Model, Types } from "mongoose";

export interface ILocation {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface IUser {
  _id?: Types.ObjectId;
  email: string;
  password: string;
  name?: string;
  phone?: string; // NEW — booking contact
  profileImage?: string;
  role: "customer" | "provider" | "admin"; // UPDATED — added customer & provider
  location?: ILocation; // NEW — geo-search
  stripeCustomerId?: string; // NEW — Stripe payments
  fcmToken?: string[];
  isActive?: boolean;
  isVerified?: boolean;
  isApproved?: boolean;
  isAvailable?: boolean;
  isDeleted?: boolean;
  otp?: string;
  expiresAt?: Date;
  passwordChangedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserInterface extends Model<IUser> {
  isUserExistByEmail(email: string): Promise<IUser>;
  compareUserPassword(
    payloadPassword: string,
    hashedPassword: string,
  ): Promise<boolean>;
  newHashedPassword(newPassword: string): Promise<string>;
  isOldTokenValid: (
    passwordChangedTime: Date,
    jwtIssuedTime: number,
  ) => Promise<boolean>;
  isJwtIssuedBeforePasswordChange(
    passwordChangeTimeStamp: Date,
    jwtIssuedTimeStamp: number,
  ): boolean;
  isUserExistByCustomId(email: string): Promise<IUser>;
}
