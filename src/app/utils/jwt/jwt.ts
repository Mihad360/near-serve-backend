import jwt, {
  JsonWebTokenError,
  NotBeforeError,
  SignOptions,
  TokenExpiredError,
} from "jsonwebtoken";
import { JwtPayload } from "../../interface/global";

export const createToken = (
  jwtPayload: JwtPayload, // Your payload type (user info)
  secretToken: string,
  expiry: string,
) => {
  return jwt.sign(jwtPayload, secretToken, {
    expiresIn: expiry,
  } as SignOptions);
};

export const verifyToken = (
  token: string,
  secret: string,
): JwtPayload | null => {
  try {
    // Cast to your interface after verification
    return jwt.verify(token, secret) as JwtPayload;
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      console.error("JWT Error: Token has expired");
    } else if (error instanceof JsonWebTokenError) {
      console.error("JWT Error: Invalid or malformed token");
    } else if (error instanceof NotBeforeError) {
      console.error("JWT Error: Token not active yet (nbf)");
    } else {
      console.error("JWT Unknown Error:", error);
    }
    return null;
  }
};
