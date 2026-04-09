import { Schema, model } from "mongoose";
import bcrypt from "bcrypt";
import { ILocation, IUser, UserInterface } from "./user.interface";

const profileImageSchema = new Schema(
  {
    path: {
      type: String,
    },
    url: {
      type: String,
    },
  },
  { _id: false },
);

const locationSchema = new Schema<ILocation>(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
    },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      trim: true,
    },
    phone: {
      type: String, // NEW
      default: null,
    },
    profileImage: {
      type: profileImageSchema,
    },
    role: {
      type: String,
      enum: ["customer", "provider", "admin"], // UPDATED
      default: "customer",
    },
    location: {
      type: locationSchema, // NEW
      default: () => ({ type: "Point", coordinates: [0, 0] }),
    },
    stripeCustomerId: {
      type: String, // NEW
      default: null,
    },
    fcmToken: {
      type: [String],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isApproved: {
      type: Boolean,
      default: false, // admin must approve first
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
userSchema.index({ location: "2dsphere" }); // required for geo-queries
userSchema.index({ email: 1 });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.statics.isUserExistByEmail = async function (email: string) {
  return this.findOne({ email, isDeleted: false }).select("+password");
};

userSchema.statics.isUserExistByCustomId = async function (email: string) {
  return this.findOne({ email });
};

userSchema.statics.compareUserPassword = async function (
  payloadPassword: string,
  hashedPassword: string,
) {
  return bcrypt.compare(payloadPassword, hashedPassword);
};

userSchema.statics.newHashedPassword = async function (newPassword: string) {
  return bcrypt.hash(newPassword, 10);
};

userSchema.statics.isOldTokenValid = async function (
  passwordChangedTime: Date,
  jwtIssuedTime: number,
) {
  const passwordChangedTimestamp = passwordChangedTime?.getTime() / 1000;

  return passwordChangedTimestamp < jwtIssuedTime;
};

userSchema.statics.isJwtIssuedBeforePasswordChange = function (
  passwordChangeTimeStamp: Date,
  jwtIssuedTimeStamp: number,
) {
  if (!passwordChangeTimeStamp) return false;

  const passwordChangedTime =
    new Date(passwordChangeTimeStamp).getTime() / 1000;

  return passwordChangedTime > jwtIssuedTimeStamp;
};

export const UserModel = model<IUser, UserInterface>("User", userSchema);
