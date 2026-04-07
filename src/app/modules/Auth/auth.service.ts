import bcrypt from "bcrypt";
import { JwtPayload as jwtPayload } from "jsonwebtoken";
import HttpStatus from "http-status";
import AppError from "../../erros/AppError";
import { UserModel } from "../User/user.model";
import { IAuth } from "./auth.interface";
import config from "../../config";
import { JwtPayload } from "../../interface/global";
import { sendEmail } from "../../utils/sendEmail";
import mongoose, { Types } from "mongoose";
import { checkOtp, generateOtp, verificationEmailTemplate } from "./auth.utils";
import { IUser } from "../User/user.interface";
import { INotification } from "../Notification/notification.interface";
import { createNotification } from "../Notification/notification.utils";
import { sendPushNotifications } from "../../utils/firebase/notification";
import { createToken, verifyToken } from "../../utils/jwt/jwt";

const loginUser = async (payload: IAuth) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await UserModel.findOne({
      email: payload.email,
    })
      .select("-passwordChangedAt")
      .session(session);

    if (!user) {
      throw new AppError(HttpStatus.NOT_FOUND, "The user is not found");
    }

    if (user?.isDeleted) {
      throw new AppError(HttpStatus.BAD_REQUEST, "The user is blocked");
    }

    if (!user.isVerified) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expireAt = new Date(Date.now() + 3 * 60 * 1000);

      await UserModel.findByIdAndUpdate(
        user._id,
        {
          otp: otp,
          expiresAt: expireAt,
        },
        { new: true, session },
      );

      const subject = "Verify your account";
      await sendEmail(
        user.email,
        subject,
        verificationEmailTemplate(user.email, otp),
      );

      await session.commitTransaction();
      session.endSession();

      return {
        message:
          "You are not verified. A new verification email has been sent.",
        user: user,
      };
    }

    if (
      !(await UserModel.compareUserPassword(payload.password, user.password))
    ) {
      throw new AppError(HttpStatus.FORBIDDEN, "Password did not match");
    }

    const userId = user._id;

    if (!userId) {
      throw new AppError(HttpStatus.NOT_FOUND, "User id is missing");
    }

    let updateUser: IUser = user;

    if (payload.fcmToken) {
      updateUser = (await UserModel.findByIdAndUpdate(
        userId,
        {
          $addToSet: { fcmToken: payload.fcmToken },
        },
        { new: true, session },
      )) as IUser;
    }

    const jwtPayload: JwtPayload = {
      user: new Types.ObjectId(updateUser?._id),
      email: updateUser?.email,
      role: updateUser?.role,
    };

    const accessToken = createToken(
      jwtPayload,
      config.JWT_SECRET_KEY as string,
      config.JWT_ACCESS_EXPIRES_IN as string,
    );

    if (accessToken) {
      const notinfo: INotification = {
        sender: new Types.ObjectId(user._id),
        type: "user_login",
        message: `User Logged in: (${user.email})`,
      };
      const notInfo = (await createNotification(
        notinfo,
        session,
      )) as Partial<INotification>;

      if (!notInfo) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          "Notification create failed",
        );
      }

      const admins = await UserModel.find({
        role: "admin",
        isVerified: true,
        fcmToken: { $exists: true, $ne: null },
      })
        .select("fcmToken")
        .session(session);

      const adminTokens: string[] = admins.flatMap(
        (admin) => admin.fcmToken ?? [],
      );

      if (adminTokens.length > 0) {
        await sendPushNotifications(
          adminTokens,
          "New User Login",
          notInfo.message as string,
        );
      }
    }

    await session.commitTransaction();
    session.endSession();

    return {
      _id: user._id,
      role: user.role,
      accessToken,
      user: updateUser,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const forgetPassword = async (email: string) => {
  const user = await UserModel.findOne({
    email: email,
  });
  if (!user) {
    throw new AppError(HttpStatus.NOT_FOUND, "This User is not exist");
  }
  if (user?.isDeleted) {
    throw new AppError(HttpStatus.FORBIDDEN, "This User is deleted");
  }

  const userId = user?._id;
  if (!userId) {
    throw new AppError(HttpStatus.NOT_FOUND, "The user id is missing");
  }

  const otp = generateOtp();
  const expireAt = new Date(Date.now() + 3 * 60 * 1000);
  const newUser = await UserModel.findOneAndUpdate(
    { email: user.email },
    {
      otp: otp,
      expiresAt: expireAt,
      isVerified: false,
    },
    { new: true },
  );
  if (newUser) {
    const subject = "Verification Code";
    const otp = newUser.otp;
    const mail = await sendEmail(
      user.email,
      subject,
      verificationEmailTemplate(user.email, otp as string),
    );
    console.log(mail);
    if (!mail.success) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Something went wrong!");
    }
    return mail;
  } else {
    throw new AppError(HttpStatus.BAD_REQUEST, "Something went wrong!");
  }
};

const verifyOtp = async (payload: { email: string; otp: string }) => {
  const user = await UserModel.findOne({
    email: payload.email,
  });

  if (!user) {
    throw new AppError(HttpStatus.NOT_FOUND, "This User does not exist");
  }

  if (user?.isDeleted) {
    throw new AppError(HttpStatus.FORBIDDEN, "This User is deleted");
  }

  // 🕒 Check OTP expiration
  if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
    await UserModel.findOneAndUpdate(
      { email: user.email },
      {
        otp: null,
        expiresAt: null,
        isVerified: false,
      },
      { new: true },
    );
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "The Otp has expired. Try again!",
    );
  }

  const check = await checkOtp(payload.email, payload.otp);

  if (check) {
    const jwtPayload: JwtPayload = {
      user: check._id,
      email: check.email,
      role: check.role,
    };

    const accessToken = createToken(
      jwtPayload,
      config.JWT_SECRET_KEY as string,
      "3m",
    );

    return { accessToken, email: check.email };
  }
};

const resetPassword = async (
  payload: { newPassword: string },
  userInfo: JwtPayload,
) => {
  const user = await UserModel.findOne({
    email: userInfo.email,
  });

  if (!user) {
    throw new AppError(HttpStatus.NOT_FOUND, "This User is not exist");
  }
  if (user?.isDeleted) {
    throw new AppError(HttpStatus.FORBIDDEN, "This User is deleted");
  }
  // Check if password was changed recently (within the last 5 minutes)
  const passwordChangedAt = user.passwordChangedAt;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes in milliseconds

  if (passwordChangedAt && passwordChangedAt > fiveMinutesAgo) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Password was recently changed. Please try again after 5 minutes.",
    );
  }

  const newHashedPassword = await UserModel.newHashedPassword(
    payload.newPassword,
  );
  const updateUser = await UserModel.findOneAndUpdate(
    { email: user.email },
    {
      password: newHashedPassword,
      passwordChangedAt: new Date(),
    },
    { new: true },
  );
  if (updateUser) {
    const jwtPayload: JwtPayload = {
      user: updateUser._id,
      email: updateUser?.email,
      role: updateUser?.role,
    };

    const accessToken = createToken(
      jwtPayload,
      config.JWT_SECRET_KEY as string,
      config.JWT_ACCESS_EXPIRES_IN as string,
    );
    return { accessToken };
  } else {
    throw new AppError(HttpStatus.BAD_REQUEST, "Something went wrong");
  }
};

const changePassword = async (
  userId: string | Types.ObjectId,
  payload: { currentPassword: string; newPassword: string },
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const id = new Types.ObjectId(userId);
    const user = await UserModel.findById(id)
      .select("+password")
      .session(session);

    if (!user) {
      throw new AppError(HttpStatus.NOT_FOUND, "User not found");
    }
    if (user.isDeleted) {
      throw new AppError(HttpStatus.FORBIDDEN, "User is blocked");
    }
    if (!payload.currentPassword || !payload.newPassword) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Password is missing");
    }

    // Verify current password
    const isMatch = await bcrypt.compare(
      payload.currentPassword,
      user.password,
    );
    if (!isMatch) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        "Current password is incorrect",
      );
    }

    // Hash new password
    const newPass = await bcrypt.hash(payload.newPassword, 12);

    // Update user with transaction
    const result = await UserModel.findByIdAndUpdate(
      user._id,
      {
        password: newPass,
        passwordChangedAt: new Date(),
      },
      { new: true, session },
    ).select("-password -otp -passwordChangedAt");

    if (!result) {
      throw new AppError(HttpStatus.UNAUTHORIZED, "Something went wrong");
    }

    // Commit transaction
    await session.commitTransaction();

    // Introduce artificial delay (2-3 seconds)
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const jwtPayload: JwtPayload = {
      user: result._id,
      email: result?.email,
      role: result?.role,
    };

    const accessToken = createToken(
      jwtPayload,
      config.JWT_SECRET_KEY as string,
      config.JWT_ACCESS_EXPIRES_IN as string,
    );

    const refreshToken = createToken(
      jwtPayload,
      config.JWT_REFRESH_KEY as string,
      config.JWT_REFRESH_EXPIRES_IN as string,
    );

    return { accessToken, refreshToken, user: result };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const resendOtp = async (email: string) => {
  const user = await UserModel.findOne({ email });

  if (!user) {
    throw new AppError(HttpStatus.NOT_FOUND, "User not found");
  }

  if (user.isDeleted) {
    throw new AppError(HttpStatus.FORBIDDEN, "This user is deleted");
  }

  // Check if OTP exists and is still valid (not expired)
  if (user.expiresAt && new Date(user.expiresAt) > new Date()) {
    // OTP is still valid, throw an error because you cannot resend it yet
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "OTP is still valid. Please try again after it expires.",
    );
  } else {
    // OTP has expired or has not been set, generate a new OTP
    const otp = generateOtp(); // Generate new OTP
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 3); // Set OTP expiration to 1 minute from now
    // Save the new OTP and expiration time to the user's record
    const updatedUser = (await UserModel.findOneAndUpdate(
      { email },
      { otp, expiresAt },
      { new: true },
    ).select("-password -passwordChangedAt -otp")) as IUser;

    // Send email with the new OTP
    const subject = "New Verification Code";
    const mail = await sendEmail(
      user.email,
      subject,
      verificationEmailTemplate(updatedUser.email as string, otp),
    );
    if (!mail) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        "Something went wrong while sending the email!",
      );
    }
    return { message: "New otp sent to your email", data: updatedUser };
  }
};

const refreshToken = async (token: string) => {
  const decoded = verifyToken(
    token,
    config.JWT_REFRESH_KEY as string,
  ) as jwtPayload;
  const { email, iat } = decoded;
  const user = await UserModel.isUserExistByCustomId(email);
  if (!user) {
    throw new AppError(HttpStatus.NOT_FOUND, "This User is not exist");
  }
  // checking if the user is already deleted
  if (user?.isDeleted) {
    throw new AppError(HttpStatus.FORBIDDEN, "This User is deleted");
  }
  if (
    user.passwordChangedAt &&
    (await UserModel.isOldTokenValid(user.passwordChangedAt, iat as number))
  ) {
    throw new AppError(HttpStatus.UNAUTHORIZED, "You are not authorized");
  }

  const jwtPayload: JwtPayload = {
    user: user._id as Types.ObjectId,
    email: user?.email,
    role: user?.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.JWT_SECRET_KEY as string,
    config.JWT_ACCESS_EXPIRES_IN as string,
  );

  return {
    role: user.role,
    accessToken,
  };
};

export const authServices = {
  loginUser,
  forgetPassword,
  resetPassword,
  changePassword,
  verifyOtp,
  resendOtp,
  refreshToken,
};
