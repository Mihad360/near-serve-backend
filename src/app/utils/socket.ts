/* eslint-disable @typescript-eslint/no-explicit-any */
import HttpStatus from "http-status";
import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import express, { Application } from "express";
import AppError from "../erros/AppError";
import { verifyToken } from "./jwt/jwt";
import { UserModel } from "../modules/User/user.model";
import config from "../config";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const app: Application = express();

declare module "socket.io" {
  interface Socket {
    user?: {
      _id: string;
      name?: string;
      email: string;
      role: string;
    };
  }
}

// Initialize the Socket.IO server
let io: SocketIOServer;
export const connectedUsers = new Map<string, { socketID: string }>();
export const connectedClients = new Map<string, Socket>();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sendResponse = (
  statusCode: number,
  status: string,
  message: string,
  data?: any,
) => ({
  statusCode,
  status,
  message,
  data,
});

export const initSocketIO = async (server: HttpServer): Promise<void> => {
  console.log("🔧 Initializing Socket.IO server 🔧");

  const { Server } = await import("socket.io");

  io = new Server(server, {
    cors: {
      origin: "*", // Replace with your client's origin
      methods: ["GET", "POST"],
      allowedHeaders: ["my-custom-header"], // Add any custom headers if needed
      credentials: true,
    },
  });

  console.log("🎉 Socket.IO server initialized! 🎉");

  // Authentication middleware: now takes the token from headers.
  io.use(async (socket: Socket, next: (err?: any) => void) => {
    const token =
      (socket.handshake.headers.token as string) ||
      (socket.handshake.auth.token as string);
    console.log(token);
    if (!token) {
      return next(new AppError(HttpStatus.UNAUTHORIZED, "Token missing"));
    }

    // Verify the token
    const userDetails = verifyToken(token, config.JWT_SECRET_KEY as string);
    if (!userDetails) {
      return next(new Error("Authentication error: Invalid token"));
    }

    const user = await UserModel.findById(userDetails.user).select(
      "_id name email role",
    );
    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    // Attach user data to the socket object
    socket.user = {
      _id: user._id.toString(),
      email: user.email,
      role: user.role as string,
    };

    // Store the socket ID in the connectedUsers map
    connectedUsers.set(socket.user._id.toString(), { socketID: socket.id });

    next();
  });

  io.on("connection", (socket: Socket) => {
    console.log("Socket just connected:", {
      socketId: socket.id,
      userId: socket.user?._id,
      name: socket.user?.name,
      email: socket.user?.email,
      role: socket.user?.role,
    });

    socket.on("userConnected", ({ userId }: { userId: string }) => {
      connectedUsers.set(userId, { socketID: socket.id });
      console.log(`User ${userId} connected with socket ID: ${socket.id}`);
    });

    if (socket.user && socket.user._id) {
      connectedUsers.set(socket.user._id.toString(), { socketID: socket.id });
      console.log(
        `Registered user ${socket.user._id.toString()} with socket ID: ${socket.id}`,
      );
    }

    socket.on("disconnect", () => {
      console.log(
        `${socket.user?.name} || ${socket.user?.email} || ${socket.user?._id} just disconnected with socket ID: ${socket.id}`,
      );

      for (const [key, value] of connectedUsers.entries()) {
        if (value.socketID === socket.id) {
          connectedUsers.delete(key);
          break;
        }
      }
    });
  });
};

// Export the Socket.IO instance
export { io };
