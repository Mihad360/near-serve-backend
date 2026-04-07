import HttpStatus from "http-status";
import AppError from "../../erros/AppError";
import { UserModel } from "../User/user.model";

export const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

export const verificationEmailTemplate = (email: string, otp: string) => {
  return `
  <div style="
      font-family: 'Arial', sans-serif;
      background: #f4f7fa;
      padding: 40px 0;
      display: flex;
      justify-content: center;
      align-items: center;
      color: #333;
    "
  >
    <div style="
        background: #ffffff;
        width: 100%;
        max-width: 520px;
        padding: 30px 35px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
        text-align: center;
      "
    >
      <img
        src="https://cdn-icons-png.flaticon.com/512/561/561188.png"
        alt="email verification"
        width="70"
        style="margin-bottom: 20px;"
      />

      <h2 style="
          margin: 0;
          font-size: 26px;
          font-weight: 600;
          color: #111;
        "
      >
        Email Verification
      </h2>

      <p style="margin-top: 10px; font-size: 16px; color: #555;">
        Dear <b>${email}</b>,<br />
        Please use the verification code below to verify your email address.
      </p>

      <div style="
          background: #4CAF50;
          color: white;
          padding: 14px 0;
          margin: 25px auto;
          width: 200px;
          border-radius: 8px;
          font-size: 32px;
          font-weight: bold;
          letter-spacing: 4px;
        "
      >
        ${otp}
      </div>

      <p style="font-size: 14px; color: #666; margin-top: 10px;">
        This code will expire in
        <b style="color:#333;">3 minutes</b>.
      </p>

      <hr style="border: none; height: 1px; background: #eee; margin: 30px 0;" />

      <p style="font-size: 12px; color: #999;">
        If you did not request this verification, please disregard this email.
      </p>
    </div>
  </div>
  `;
};

export const checkOtp = async (email: string, otp: string) => {
  // Find user
  const otpUser = await UserModel.findOne({ email });
  if (!otpUser) {
    throw new AppError(HttpStatus.NOT_FOUND, "User not found");
  }

  // Validate OTP
  if (otpUser.otp !== otp) {
    // Just throw error. Do NOT delete user.
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Invalid OTP. Please try again.",
    );
  }

  // OTP correct → verify user
  const updateUser = await UserModel.findOneAndUpdate(
    { email },
    {
      otp: null,
      expiresAt: null,
      isVerified: true,
    },
    { new: true },
  ).select("-password");

  return updateUser;
};
