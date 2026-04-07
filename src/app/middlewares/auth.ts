import HttpStatus from "http-status";
import { NextFunction, Request, Response } from "express";
import catchAsync from "../utils/catchAsync";
import config from "../config";
import { UserModel } from "../modules/User/user.model";
import AppError from "../erros/AppError";
import { JwtPayload, TUserRole } from "../interface/global";
import { verifyToken } from "../utils/jwt/jwt";

const auth = (...requiredRoles: TUserRole[]) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // 1. Check if Authorization header is present and properly formatted
    const headerToken = req.headers.authorization;
    if (!headerToken || !headerToken.startsWith("Bearer ")) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        "No token provided or bad format",
      );
    }

    // 2. Extract token from header
    const token = headerToken.split(" ")[1];
    if (!token) {
      throw new AppError(HttpStatus.UNAUTHORIZED, "You are not authorized");
    }

    // 3. Verify token and get decoded payload
    let decoded: JwtPayload;
    try {
      decoded = verifyToken(
        token,
        config.JWT_SECRET_KEY as string,
      ) as JwtPayload; // Use correct config key (JWT_SECRET_KEY)
    } catch (error) {
      console.error("Token verification failed:", error);
      throw new AppError(HttpStatus.UNAUTHORIZED, "Unauthorized");
    }

    // 4. Destructure required info from payload
    const { role, email, iat } = decoded;

    // 5. Validate existence of role and email in payload
    if (!role) {
      throw new AppError(HttpStatus.UNAUTHORIZED, "User role missing in token");
    }
    if (!email) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        "User email missing in token",
      );
    }

    // 6. Find user from DB using email
    const user = await UserModel.isUserExistByEmail(email);
    if (!user) {
      throw new AppError(HttpStatus.NOT_FOUND, "User does not exist");
    }
    if (user.isDeleted) {
      throw new AppError(HttpStatus.FORBIDDEN, "This user is deleted");
    }

    // 7. Check if user role is allowed (if roles are specified)
    if (requiredRoles.length && !requiredRoles.includes(role)) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        "You are not authorized to access this resource",
      );
    }

    // 8. Check if password changed after token was issued
    if (
      user.passwordChangedAt &&
      !(await UserModel.isOldTokenValid(user.passwordChangedAt, iat as number))
    ) {
      // isOldTokenValid returns true if password changed time < token issued time (token still valid)
      // So here negation means token is invalid if password changed after token issued
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        "Token expired due to password change",
      );
    }

    // 9. Attach user info to request object
    req.user = decoded;

    next();
  });
};

export default auth;
