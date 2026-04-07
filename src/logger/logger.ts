import { createLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import fs from "fs";
import { Request, Response, NextFunction } from "express";

import { blue, green, red, yellowBright, magenta, yellow } from "colorette";

// Ensure the logs directory exists
const logDirectory = path.join(__dirname, "logs");
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory);
}

export const logger = createLogger({
  level: "info", // Set the appropriate logging level
  format: format.combine(
    format.timestamp({ format: "DD-MM-YYYY HH:mm:ss" }),
    format.errors({ stack: true }),
    format.splat(),
    format.json(),
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join(logDirectory, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "error", // Logs only error level
      format: format.combine(format.uncolorize(), format.json()), // Ensure no color in files
    }),
    new DailyRotateFile({
      filename: path.join(logDirectory, "combined-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      format: format.combine(format.uncolorize(), format.json()), // Ensure no color in files
    }),
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
  ],
});

// Middleware to log HTTP requests
export const logHttpRequests = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const startTime = Date.now();

  res.on("finish", () => {
    const colorizeByStatusCode = (statusCode: number) => {
      if (statusCode >= 200 && statusCode < 300) {
        return green(`${statusCode} 🎉`);
      } else if (statusCode >= 400 && statusCode < 500) {
        return red(`${statusCode} ⚠️`);
      } else if (statusCode >= 500) {
        return yellowBright(`${statusCode} 🔥`);
      }
      return blue(`${statusCode} ❗`);
    };

    const colorizeByMethod = (method: string) => {
      if (method === "GET") {
        return green(method + " 🔍");
      } else if (method === "POST") {
        return blue(method + " ✏️");
      } else if (method === "PATCH") {
        return yellowBright(method + " ✨");
      } else if (method === "PUT") {
        return yellow(method + " 🛠️");
      } else if (method === "DELETE") {
        return red(method + " ❌");
      }
      return magenta(method + " Unknown 😢☹️");
    };

    const clientIp = req.ip
      ? req.ip.startsWith("::ffff:")
        ? req.ip.substring(7)
        : req.ip
      : "Unknown IP";

    logger.info({
      message: `🖥️ IP: ${clientIp} 🌐 ${colorizeByMethod(req.method)} ${colorizeByStatusCode(res.statusCode)} ${magenta(req.originalUrl)} ⏱️ Response Time: ${yellowBright(`${Date.now() - startTime} ms`)}`,
      size: res.get("Content-Length") || 0,
    });
  });

  next();
};
