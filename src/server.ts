/* eslint-disable @typescript-eslint/no-explicit-any */
import app from "./app";
import config from "./app/config";
import mongoose from "mongoose";
import { Server } from "http";
import { initSocketIO } from "./app/utils/socket";
import seedSuperAdmin, { seedAbout, seedPrivacy, seedTerms } from "./app/DB";

let server: Server;

async function main() {
  try {
    await mongoose.connect(config.DATABASE_URL as string, {
      dbName: "Near-Serve",
    });
    console.log("Database connected successfully");

    server = app.listen(config.PORT, () => {
      console.log(`App listening on port ${config.PORT}`);
    });

    initSocketIO(server);

    seedSuperAdmin().catch((err) =>
      console.error("Super admin seeding error:", err),
    );
    seedPrivacy();
    seedTerms();
    seedAbout();
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
}

// Graceful shutdown helper
async function gracefulShutdown(signal?: string) {
  try {
    console.log(
      `\n${signal ? signal + " received." : ""} Shutting down gracefully...`,
    );

    // Close server
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      });
      console.log("HTTP server closed");
    }

    // Close DB connection
    await mongoose.disconnect();
    console.log("MongoDB connection closed");

    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown", err);
    process.exit(1);
  }
}

main();

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: any, promise) => {
  console.error("💥 Unhandled Rejection detected:");
  console.error("👉 Reason:", reason);
  console.error("👉 Promise:", promise);
  // Gracefully shutdown
  gracefulShutdown("unhandledRejection");
});

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  console.error("💥 Uncaught Exception detected:");
  console.error(error);
  // Gracefully shutdown
  gracefulShutdown("uncaughtException");
});

// Handle termination signals (optional but recommended)
process.on("SIGTERM", () => {
  console.log("SIGTERM received");
  gracefulShutdown("SIGTERM");
});

process.on("SIGINT", () => {
  console.log("SIGINT received");
  gracefulShutdown("SIGINT");
});
